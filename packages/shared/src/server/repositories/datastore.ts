import { env } from "../../env";
import { datastoreClient, convertDateToDatastoreDateTime, PreferredDatastoreService } from "../datastore/client";
import { logger } from "../logger";
import { getTracer, instrumentAsync } from "../instrumentation";
import { randomUUID } from "crypto";
import { getDatastoreEntityType } from "../datastore/schemaUtils";
import type { DatastoreClientConfig, DatastoreSettings } from "../datastore/types";
import { context, SpanKind, trace } from "@opentelemetry/api";
import { backOff } from "exponential-backoff";
import { StorageService, StorageServiceFactory } from "../services/StorageService";
import { RESOURCE_LIMIT_ERROR_MESSAGE } from "../../errors/errorMessages";

/**
 * Custom error class for datastore resource-related errors
 */
// Error type configuration map
const ERROR_TYPE_CONFIG: Record<
  "MEMORY_LIMIT" | "OVERCOMMIT" | "TIMEOUT",
  {
    discriminators: string[];
  }
> = {
  MEMORY_LIMIT: {
    discriminators: ["memory limit exceeded"],
  },
  OVERCOMMIT: {
    discriminators: ["OvercommitTracker"],
  },
  TIMEOUT: {
    discriminators: ["Timeout", "timeout", "timed out"],
  },
};

type ErrorType = keyof typeof ERROR_TYPE_CONFIG;

export class DatastoreResourceError extends Error {
  static ERROR_ADVICE_MESSAGE = RESOURCE_LIMIT_ERROR_MESSAGE;

  public readonly errorType: ErrorType;

  constructor(errType: ErrorType, originalError: Error) {
    super(originalError.message, { cause: originalError });
    this.name = "DatastoreResourceError";
    this.errorType = errType;
    // Preserve the original stack trace if available
    if (originalError.stack) {
      this.stack = originalError.stack;
    }
  }

  static wrapIfResourceError(originalError: Error): Error {
    const errorMessage = originalError.message || "";

    for (const [type, config] of Object.entries(ERROR_TYPE_CONFIG) as Array<
      [keyof typeof ERROR_TYPE_CONFIG, (typeof ERROR_TYPE_CONFIG)[keyof typeof ERROR_TYPE_CONFIG]]
    >) {
      const hasDiscriminator = config.discriminators.some((discriminator) => errorMessage.includes(discriminator));

      if (hasDiscriminator) {
        return new DatastoreResourceError(type, originalError);
      }
    }

    return originalError;
  }
}

let s3StorageServiceClient: StorageService;

const getS3StorageServiceClient = (bucketName: string): StorageService => {
  if (!s3StorageServiceClient) {
    s3StorageServiceClient = StorageServiceFactory.getInstance({
      bucketName,
      accessKeyId: env.S3_EVENT_UPLOAD_ACCESS_KEY_ID,
      secretAccessKey: env.S3_EVENT_UPLOAD_SECRET_ACCESS_KEY,
      endpoint: env.S3_EVENT_UPLOAD_ENDPOINT,
      region: env.S3_EVENT_UPLOAD_REGION,
      forcePathStyle: env.S3_EVENT_UPLOAD_FORCE_PATH_STYLE === "true",
      awsSse: env.S3_EVENT_UPLOAD_SSE,
      awsSseKmsKeyId: env.S3_EVENT_UPLOAD_SSE_KMS_KEY_ID,
    });
  }
  return s3StorageServiceClient;
};

/**
 * Guard against reads from the legacy 'events' table.
 * Reads must use events_core or events_full instead.
 * Matches "FROM events" or "JOIN events" as a standalone table name
 * (not events_core, events_full, or CTE aliases like filtered_events).
 */
const LEGACY_EVENTS_TABLE_PATTERN = /\b(?:from|join)\s+events\b(?!_)/i;

function assertNoLegacyEventsRead(query: string): void {
  if (LEGACY_EVENTS_TABLE_PATTERN.test(query)) {
    throw new Error(
      `Reading from legacy 'events' table is forbidden. Use events_core or events_full. Query: ${query.slice(0, 200)}`,
    );
  }
}

export async function upsertDatastore<T extends Record<string, unknown>>(opts: {
  table: "scores" | "traces" | "observations" | "traces_null";
  records: T[];
  eventBodyMapper: (body: T) => Record<string, unknown>;
  tags?: Record<string, string>;
}): Promise<void> {
  return await instrumentAsync({ name: "datastore-upsert", spanKind: SpanKind.CLIENT }, async (span) => {
    // https://opentelemetry.io/docs/specs/semconv/database/database-spans/
    span.setAttribute("ch.query.table", opts.table);
    span.setAttribute("db.system", "datastore");
    span.setAttribute("db.operation.name", "UPSERT");

    await Promise.all(
      opts.records.map(async (record) => {
        // drop trailing s and pretend it's always a create.
        // Only applicable to scores and traces.
        let eventType = `${opts.table.slice(0, -1)}-create`;
        if (opts.table === "observations") {
          // @ts-ignore - If it's an observation we know that `type` is a string
          eventType = `${record["type"].toLowerCase()}-create`;
        }

        const eventId = randomUUID();
        const bucketPath = `${env.S3_EVENT_UPLOAD_PREFIX}${record.project_id}/${getDatastoreEntityType(eventType)}/${record.id}/${eventId}.json`;

        if (env.HANZO_ENABLE_BLOB_STORAGE_FILE_LOG === "true") {
          // Write new file directly to the datastore. We don't use the async writer here as we expect more limited traffic
          // and are not worried that much about latency.
          await datastoreClient().insert({
            table: "blob_storage_file_log",
            values: [
              {
                id: randomUUID(),
                project_id: record.project_id,
                entity_type: getDatastoreEntityType(eventType),
                entity_id: record.id,
                event_id: eventId,
                bucket_name: env.S3_EVENT_UPLOAD_BUCKET,
                bucket_path: bucketPath,
                event_ts: convertDateToDatastoreDateTime(new Date()),
                is_deleted: 0,
              },
            ],
            format: "JSONEachRow",
            datastore_settings: {
              log_comment: JSON.stringify(opts.tags ?? {}),
            },
          });
        }

        return getS3StorageServiceClient(env.S3_EVENT_UPLOAD_BUCKET).uploadJson(bucketPath, [
          {
            id: eventId,
            timestamp: new Date().toISOString(),
            type: eventType,
            body: opts.eventBodyMapper(record),
          },
        ]);
      }),
    );

    const res = await datastoreClient().insert({
      table: opts.table,
      values: opts.records.map((record) => ({
        ...record,
        event_ts: convertDateToDatastoreDateTime(new Date()),
      })),
      format: "JSONEachRow",
      datastore_settings: {
        log_comment: JSON.stringify(opts.tags ?? {}),
      },
    });
    // same logic as for prisma. we want to see queries in development
    if (env.NODE_ENV === "development") {
      logger.info(`datastore:insert ${res.query_id} ${opts.table}`);
    }

    span.setAttribute("ch.queryId", res.query_id);

    // add summary headers to the span. Helps to tune performance
    const summaryHeader = res.response_headers?.["x-datastore-summary"];
    if (summaryHeader) {
      try {
        const summary = Array.isArray(summaryHeader) ? JSON.parse(summaryHeader[0]) : JSON.parse(summaryHeader);
        for (const key in summary) {
          span.setAttribute(`ch.${key}`, summary[key]);
        }
      } catch (error) {
        logger.debug(`Failed to parse datastore summary header ${summaryHeader}`, error);
      }
    }
  });
}

export async function* queryDatastoreStream<T>(opts: {
  query: string;
  params?: Record<string, unknown> | undefined;
  datastoreConfig?: DatastoreClientConfig;
  tags?: Record<string, string>;
  preferredService?: PreferredDatastoreService;
  datastoreSettings?: DatastoreSettings;
  allowLegacyEventsRead?: boolean;
}): AsyncGenerator<T> {
  if (!opts.allowLegacyEventsRead) assertNoLegacyEventsRead(opts.query);

  const tracer = getTracer("datastore-query-stream");
  const span = tracer.startSpan("datastore-query-stream", {
    kind: SpanKind.CLIENT,
  });

  try {
    const res = await context
      .with(trace.setSpan(context.active(), span), async () => {
        // https://opentelemetry.io/docs/specs/semconv/database/database-spans/
        span.setAttribute("ch.query.text", opts.query);
        span.setAttribute("db.system", "datastore");
        span.setAttribute("db.query.text", opts.query);
        span.setAttribute("db.operation.name", "SELECT");

        const res = await datastoreClient(opts.datastoreConfig, opts.preferredService).query({
          query: opts.query,
          format: "JSONEachRow",
          query_params: opts.params,
          datastore_settings: {
            ...opts.datastoreSettings,
            log_comment: JSON.stringify(opts.tags ?? {}),
          },
        });

        // same logic as for prisma. we want to see queries in development
        if (env.NODE_ENV === "development") {
          logger.info(`datastore:query ${res.query_id} ${opts.query}`);
        }

        span.setAttribute("ch.queryId", res.query_id);

        // add summary headers to the span. Helps to tune performance
        const summaryHeader = res.response_headers["x-datastore-summary"];
        if (summaryHeader) {
          try {
            const summary = Array.isArray(summaryHeader) ? JSON.parse(summaryHeader[0]) : JSON.parse(summaryHeader);
            for (const key in summary) {
              span.setAttribute(`ch.${key}`, summary[key]);
            }
          } catch (error) {
            logger.debug(`Failed to parse datastore summary header ${summaryHeader}`, error);
          }
        }
        return res;
      })
      .catch((error) => {
        // Transform resource errors to provide actionable advice
        throw DatastoreResourceError.wrapIfResourceError(error as Error);
      });

    for await (const rows of res.stream<T>()) {
      for (const row of rows) {
        yield handleExceptionRow(row.json());
      }
    }
  } catch (error) {
    // Also catch errors during streaming
    throw DatastoreResourceError.wrapIfResourceError(error as Error);
  } finally {
    span.end();
  }
}

/**
 * The datastore (Datastore) has a quirk when it comes to handling exceptions mid response.
 * It will simply output a row with "exception" key inside, which is indistinguishable from
 * a query like `SELECT "my lovely string" AS exception;` may return.
 *
 * E.g.:
 * ```
 * {"exception":"Code: 395. DB::Exception: memory limit exceeded: would use l0.23 GiB"}
 * ```
 *
 * This function makes the best effort to convert such rows into errors and throws them.
 *
 * See:
 * - https://github.com/Datastore/datastore-js/issues/332 (historical reference)
 * - https://github.com/Datastore/Datastore/issues/75175
 *
 * Ideally this should get fixed in the future versions of Datastore.
 */
function handleExceptionRow<T>(parsedRow: T): T {
  if (
    typeof parsedRow === "object" &&
    parsedRow !== null &&
    Object.keys(parsedRow).length === 1 &&
    "exception" in parsedRow
  ) {
    const potentialException = (parsedRow as { exception: string }).exception;
    if (potentialException.match(/^Code: (\d+)/)) {
      logger.error(`[datastore] Exception row detected: ${potentialException}`, parsedRow);
      throw new Error(potentialException);
    }
  }
  return parsedRow;
}

/**
 * Determines if an error is retryable (socket hang up, connection reset, broken pipe, etc.)
 */
function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const errorMessage = (error as Error).message?.toLowerCase() || "";

  // Check for socket hang up and other network-related errors
  const retryablePatterns = [
    "socket hang up",
    "broken pipe",
    "connection reset",
    "econnreset",
    "network_error",
    "etimedout",
    "econnrefused",
  ];

  return retryablePatterns.some((pattern) => errorMessage.includes(pattern));
}

export async function queryDatastore<T>(opts: {
  query: string;
  params?: Record<string, unknown> | undefined;
  datastoreConfig?: DatastoreClientConfig;
  tags?: Record<string, string>;
  preferredService?: PreferredDatastoreService;
  datastoreSettings?: DatastoreSettings;
  allowLegacyEventsRead?: boolean;
}): Promise<T[]> {
  if (!opts.allowLegacyEventsRead) assertNoLegacyEventsRead(opts.query);

  return await instrumentAsync({ name: "datastore-query", spanKind: SpanKind.CLIENT }, async (span) => {
    // https://opentelemetry.io/docs/specs/semconv/database/database-spans/
    span.setAttribute("ch.query.text", opts.query);
    span.setAttribute("db.system", "datastore");
    span.setAttribute("db.query.text", opts.query);
    span.setAttribute("db.operation.name", "SELECT");

    // Retry logic for socket hang up and other network errors
    return await backOff(
      async () => {
        // same logic as for prisma. we want to see queries in development
        if (env.NODE_ENV === "development") {
          logger.info(`datastore:query ${opts.query}`);
        }
        const res = await datastoreClient(opts.datastoreConfig, opts.preferredService).query({
          query: opts.query,
          format: "JSONEachRow",
          query_params: opts.params,
          datastore_settings: {
            asterisk_include_alias_columns: 1,
            asterisk_include_materialized_columns: 1,
            ...opts.datastoreSettings,
            log_comment: JSON.stringify(opts.tags ?? {}),
          },
        });

        span.setAttribute("ch.queryId", res.query_id);

        // add summary headers to the span. Helps to tune performance
        const summaryHeader = res.response_headers["x-datastore-summary"];
        if (summaryHeader) {
          try {
            const summary = Array.isArray(summaryHeader) ? JSON.parse(summaryHeader[0]) : JSON.parse(summaryHeader);
            for (const key in summary) {
              span.setAttribute(`ch.${key}`, summary[key]);
            }
          } catch (error) {
            logger.debug(`Failed to parse datastore summary header ${summaryHeader}`, error);
          }
        }

        return (await res.json<T>()).data.map(handleExceptionRow);
      },
      {
        numOfAttempts: env.DATASTORE_QUERY_MAX_ATTEMPTS,
        retry: (error: Error, attemptNumber: number) => {
          const shouldRetry = isRetryableError(error);
          if (shouldRetry) {
            logger.warn(
              `Datastore query failed with retryable error (attempt ${attemptNumber}/${env.DATASTORE_QUERY_MAX_ATTEMPTS}): ${error.message}`,
              {
                error: error.message,
                attemptNumber,
                tags: opts.tags,
              },
            );
            span.addEvent("datastore-query-retry", {
              "retry.attempt": attemptNumber,
              "retry.error": error.message,
            });
          } else {
            logger.error(`Datastore query failed with non-retryable error: ${error.message}`, {
              error: error.message,
              tags: opts.tags,
            });
          }
          return shouldRetry;
        },
        startingDelay: 100,
        timeMultiple: 1,
        maxDelay: 100,
      },
    ).catch((error) => {
      // Transform resource errors to provide actionable advice
      throw DatastoreResourceError.wrapIfResourceError(error as Error);
    });
  });
}

export async function commandDatastore(opts: {
  query: string;
  params?: Record<string, unknown> | undefined;
  datastoreConfig?: DatastoreClientConfig;
  tags?: Record<string, string>;
  datastoreSettings?: DatastoreSettings;
  abortSignal?: AbortSignal;
  session_id?: string;
}): Promise<void> {
  return await instrumentAsync({ name: "datastore-command", spanKind: SpanKind.CLIENT }, async (span) => {
    // https://opentelemetry.io/docs/specs/semconv/database/database-spans/
    span.setAttribute("ch.query.text", opts.query);
    span.setAttribute("db.system", "datastore");
    span.setAttribute("db.query.text", opts.query);
    span.setAttribute("db.operation.name", "COMMAND");

    const res = await datastoreClient(opts.datastoreConfig).command({
      query: opts.query,
      query_params: opts.params,
      ...(opts.session_id ? { session_id: opts.session_id } : {}),
      ...(opts.tags?.queryId ? { query_id: opts.tags.queryId as string } : {}),
      ...(opts.abortSignal ? { abort_signal: opts.abortSignal } : {}),
      datastore_settings: {
        ...opts.datastoreSettings,
        log_comment: JSON.stringify(opts.tags ?? {}),
      },
    });
    // same logic as for prisma. we want to see queries in development
    if (env.NODE_ENV === "development") {
      logger.info(`datastore:query ${res.query_id} ${opts.query}`);
    }

    span.setAttribute("ch.queryId", res.query_id);

    // add summary headers to the span. Helps to tune performance
    const summaryHeader = res.response_headers?.["x-datastore-summary"];
    if (summaryHeader) {
      try {
        const summary = Array.isArray(summaryHeader) ? JSON.parse(summaryHeader[0]) : JSON.parse(summaryHeader);
        for (const key in summary) {
          span.setAttribute(`ch.${key}`, summary[key]);
        }
      } catch (error) {
        logger.debug(`Failed to parse datastore summary header ${summaryHeader}`, error);
      }
    }
  });
}

export function parseDatastoreUTCDateTimeFormat(dateStr: string): Date {
  return new Date(`${dateStr.replace(" ", "T")}Z`);
}

export function datastoreCompliantRandomCharacters() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  const randomArray = new Uint8Array(5);
  crypto.getRandomValues(randomArray);
  randomArray.forEach((number) => {
    result += chars[number % chars.length];
  });
  return result;
}
