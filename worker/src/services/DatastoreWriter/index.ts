import {
  datastoreClient,
  DatastoreClient,
  BlobStorageFileLogInsertType,
  getCurrentSpan,
  ObservationRecordInsertType,
  ObservationBatchStagingRecordInsertType,
  recordGauge,
  recordHistogram,
  recordIncrement,
  ScoreRecordInsertType,
  TraceRecordInsertType,
  TraceNullRecordInsertType,
  DatasetRunItemRecordInsertType,
  EventRecordInsertType,
} from "@hanzo/shared/src/server";

import { env } from "../../env";
import { logger } from "@hanzo/shared/src/server";
import { instrumentAsync } from "@hanzo/shared/src/server";
import { backOff } from "exponential-backoff";

export class DatastoreWriter {
  private static instance: DatastoreWriter | null = null;
  private static client: DatastoreClient | null = null;
  batchSize: number;
  writeInterval: number;
  maxAttempts: number;
  queue: DatastoreQueue;

  isIntervalFlushInProgress: boolean;
  intervalId: NodeJS.Timeout | null = null;

  private constructor() {
    this.batchSize = env.DATASTORE_INGESTION_WRITE_BATCH_SIZE;
    this.writeInterval = env.DATASTORE_INGESTION_WRITE_INTERVAL_MS;
    this.maxAttempts = env.DATASTORE_INGESTION_MAX_ATTEMPTS;

    this.isIntervalFlushInProgress = false;

    this.queue = {
      [TableName.Traces]: [],
      [TableName.TracesNull]: [],
      [TableName.Scores]: [],
      [TableName.Observations]: [],
      [TableName.ObservationsBatchStaging]: [],
      [TableName.BlobStorageFileLog]: [],
      [TableName.DatasetRunItems]: [],
      [TableName.Events]: [],
    };

    this.start();
  }

  /**
   * Get the singleton instance of DatastoreWriter.
   * Client parameter is only used for testing.
   */
  public static getInstance(datastoreClient?: DatastoreClient) {
    if (datastoreClient) {
      DatastoreWriter.client = datastoreClient;
    }

    if (!DatastoreWriter.instance) {
      DatastoreWriter.instance = new DatastoreWriter();
    }

    return DatastoreWriter.instance;
  }

  private start() {
    logger.info(`Starting DatastoreWriter. Max interval: ${this.writeInterval} ms, Max batch size: ${this.batchSize}`);

    this.intervalId = setInterval(() => {
      if (this.isIntervalFlushInProgress) return;

      this.isIntervalFlushInProgress = true;

      logger.debug("Flush interval elapsed, flushing all queues...");

      this.flushAll().finally(() => {
        this.isIntervalFlushInProgress = false;
      });
    }, this.writeInterval);
  }

  public async shutdown(): Promise<void> {
    logger.info("Shutting down DatastoreWriter...");

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await this.flushAll(true);

    logger.info("DatastoreWriter shutdown complete.");
  }

  private async flushAll(fullQueue = false) {
    return instrumentAsync(
      {
        name: "write-to-datastore",
      },
      async () => {
        recordIncrement("hanzo.queue.datastore_writer.request");
        await Promise.all([
          this.flush(TableName.Traces, fullQueue),
          this.flush(TableName.TracesNull, fullQueue),
          this.flush(TableName.Scores, fullQueue),
          this.flush(TableName.Observations, fullQueue),
          this.flush(TableName.ObservationsBatchStaging, fullQueue),
          this.flush(TableName.BlobStorageFileLog, fullQueue),
          this.flush(TableName.DatasetRunItems, fullQueue),
          this.flush(TableName.Events, fullQueue),
        ]).catch((err) => {
          logger.error("DatastoreWriter.flushAll", err);
        });
      },
    );
  }

  private isRetryableError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;

    const errorMessage = (error as Error).message?.toLowerCase() || "";

    // Check for socket hang up and other network-related errors
    return errorMessage.includes("socket hang up");
  }

  private isSizeError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;

    const errorMessage = (error as Error).message?.toLowerCase() || "";

    return (
      // Check for Datastore size errors
      errorMessage.includes("size of json object") &&
      errorMessage.includes("extremely large") &&
      errorMessage.includes("expected not greater than")
    );
  }

  private isStringLengthError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;

    const errorMessage = (error as Error).message?.toLowerCase() || "";

    // Node.js string size errors
    return errorMessage.includes("invalid string length");
  }

  /**
   * handleStringLength takes the queueItems and splits the queue in half.
   * It returns to lists, one items that are to be retried (first half), and a list that
   * should be re-added to the queue (second half).
   * That way, we should eventually avoid the JS string length error that happens due to the
   * concatenation.
   */
  private handleStringLengthError<T extends TableName>(
    tableName: T,
    queueItems: DatastoreWriterQueueItem<T>[],
  ): {
    retryItems: DatastoreWriterQueueItem<T>[];
    requeueItems: DatastoreWriterQueueItem<T>[];
  } {
    // If batch size is 1, fallback to truncation to prevent infinite loops
    if (queueItems.length === 1) {
      const truncatedRecord = this.truncateOversizedRecord(tableName, queueItems[0].data);
      logger.warn(`String length error with single record for ${tableName}, falling back to truncation`, {
        recordId: queueItems[0].data.id,
      });
      return {
        retryItems: [{ ...queueItems[0], data: truncatedRecord }],
        requeueItems: [],
      };
    }

    const splitPoint = Math.floor(queueItems.length / 2);
    const retryItems = queueItems.slice(0, splitPoint);
    const requeueItems = queueItems.slice(splitPoint);

    logger.info(
      `Splitting batch for ${tableName} due to string length error. Retrying ${retryItems.length}, requeueing ${requeueItems.length}`,
    );

    return { retryItems, requeueItems };
  }

  private truncateOversizedRecord<T extends TableName>(tableName: T, record: RecordInsertType<T>): RecordInsertType<T> {
    const maxFieldSize = 1024 * 1024; // 1MB per field as safety margin
    const truncationMessage = "[TRUNCATED: Field exceeded size limit]";

    // Helper function to safely truncate string fields
    const truncateField = (value: string | null | undefined): string | null => {
      if (!value) return value || null;
      if (value.length > maxFieldSize) {
        return (
          // Keep the first 500KB and append a truncation message
          value.substring(0, 500 * 1024) + truncationMessage
        );
      }
      return value;
    };

    // Truncate input field if present
    if ("input" in record && record.input && record.input.length > maxFieldSize) {
      record.input = truncateField(record.input);
      logger.info(`Truncated oversized input field for record ${record.id} of type ${tableName}`, {
        projectId: record.project_id,
      });
    }

    // Truncate output field if present
    if ("output" in record && record.output && record.output.length > maxFieldSize) {
      record.output = truncateField(record.output);
      logger.info(`Truncated oversized output field for record ${record.id} of type ${tableName}`, {
        projectId: record.project_id,
      });
    }

    // Truncate metadata field if present
    if ("metadata" in record && record.metadata) {
      const metadata = record.metadata;
      const truncatedMetadata: Record<string, string> = {};
      for (const [key, value] of Object.entries(metadata)) {
        if (value && value.length > maxFieldSize) {
          truncatedMetadata[key] = truncateField(value) || "";
          logger.info(`Truncated oversized metadata for record ${record.id} of type ${tableName} and key ${key}`, {
            projectId: record.project_id,
          });
        } else {
          truncatedMetadata[key] = value;
        }
      }
      record.metadata = truncatedMetadata;
    }

    return record;
  }

  private async flush<T extends TableName>(tableName: T, fullQueue = false) {
    const entityQueue = this.queue[tableName];
    if (entityQueue.length === 0) return;

    let queueItems = entityQueue.splice(0, fullQueue ? entityQueue.length : this.batchSize);

    // Log wait time
    queueItems.forEach((item) => {
      const waitTime = Date.now() - item.createdAt;
      recordHistogram("hanzo.queue.datastore_writer.wait_time", waitTime, {
        unit: "milliseconds",
      });
    });

    const currentSpan = getCurrentSpan();
    if (currentSpan) {
      currentSpan.setAttributes({
        [`${tableName}-length`]: queueItems.length,
      });
    }

    try {
      const processingStartTime = Date.now();

      let recordsToWrite = queueItems.map((item) => item.data);
      let hasBeenTruncated = false;

      await backOff(
        async () =>
          this.writeToDatastore({
            table: tableName,
            records: recordsToWrite,
          }),
        {
          numOfAttempts: env.DATASTORE_INGESTION_MAX_ATTEMPTS,
          retry: (error: Error, attemptNumber: number) => {
            const isRetryable = this.isRetryableError(error);
            const isSizeError = this.isSizeError(error);
            const isStringLengthError = this.isStringLengthError(error);

            if (isRetryable) {
              logger.warn(
                `Datastore Writer failed with retryable error for ${tableName} (attempt ${attemptNumber}/${env.DATASTORE_INGESTION_MAX_ATTEMPTS}): ${error.message}`,
                {
                  error: error.message,
                  attemptNumber,
                },
              );
              currentSpan?.addEvent("datastore-query-retry", {
                "retry.attempt": attemptNumber,
                "retry.error": error.message,
              });
              return true;
            } else if (isStringLengthError) {
              logger.warn(
                `Datastore Writer failed with string length error for ${tableName} (attempt ${attemptNumber}/${env.DATASTORE_INGESTION_MAX_ATTEMPTS}): Splitting batch and retrying`,
                {
                  error: error.message,
                  attemptNumber,
                  batchSize: queueItems.length,
                },
              );

              const { retryItems, requeueItems } = this.handleStringLengthError(tableName, queueItems);

              // Update records to write with only the retry items
              recordsToWrite = retryItems.map((item) => item.data);
              queueItems = retryItems;

              // Prepend requeue items to the front of the queue to maintain order as much as possible with parallel execution.
              if (requeueItems.length > 0) {
                entityQueue.unshift(...requeueItems);
              }

              currentSpan?.addEvent("datastore-query-split-retry", {
                "retry.attempt": attemptNumber,
                "retry.error": error.message,
                "split.retry_count": retryItems.length,
                "split.requeue_count": requeueItems.length,
              });
              return true;
            } else if (isSizeError && !hasBeenTruncated) {
              logger.warn(
                `Datastore Writer failed with size error for ${tableName} (attempt ${attemptNumber}/${env.DATASTORE_INGESTION_MAX_ATTEMPTS}): Truncating oversized records and retrying`,
                {
                  error: error.message,
                  attemptNumber,
                },
              );

              // Truncate oversized records
              recordsToWrite = recordsToWrite.map((record) => this.truncateOversizedRecord(tableName, record));
              hasBeenTruncated = true;

              currentSpan?.addEvent("datastore-query-truncate-retry", {
                "retry.attempt": attemptNumber,
                "retry.error": error.message,
                truncated: true,
              });
              return true;
            } else {
              logger.error(`Datastore query failed with non-retryable error: ${error.message}`, {
                error: error.message,
              });
              return false;
            }
          },
          startingDelay: 100,
          timeMultiple: 1,
          maxDelay: 100,
        },
      );

      // Log processing time
      recordHistogram("hanzo.queue.datastore_writer.processing_time", Date.now() - processingStartTime, {
        unit: "milliseconds",
      });

      logger.debug(
        `Flushed ${queueItems.length} records to Datastore ${tableName}. New queue length: ${entityQueue.length}`,
      );

      recordGauge("ingestion_datastore_insert_queue_length", entityQueue.length, {
        unit: "records",
        entityType: tableName,
      });
    } catch (err) {
      logger.error(`DatastoreWriter.flush ${tableName}`, err);

      // Re-add the records to the queue with incremented attempts
      let droppedCount = 0;
      queueItems.forEach((item) => {
        if (item.attempts < this.maxAttempts) {
          entityQueue.push({
            ...item,
            attempts: item.attempts + 1,
          });
        } else {
          // TODO - Add to a dead letter queue in Redis rather than dropping
          recordIncrement("hanzo.queue.datastore_writer.error");
          droppedCount++;
        }
      });

      if (droppedCount > 0) {
        logger.error(`DatastoreWriter: Max attempts reached, dropped ${droppedCount} ${tableName} record(s)`);
      }
    }
  }

  public addToQueue<T extends TableName>(tableName: T, data: RecordInsertType<T>) {
    const entityQueue = this.queue[tableName];
    entityQueue.push({
      createdAt: Date.now(),
      attempts: 1,
      data,
    });

    if (entityQueue.length >= this.batchSize) {
      logger.debug(`Queue is full. Flushing ${tableName}...`);

      this.flush(tableName).catch((err) => {
        logger.error("DatastoreWriter.addToQueue flush", err);
      });
    }
  }

  private async writeToDatastore<T extends TableName>(params: {
    table: T;
    records: RecordInsertType<T>[];
  }): Promise<void> {
    const startTime = Date.now();

    await (DatastoreWriter.client ?? datastoreClient())
      .insert({
        table: params.table,
        format: "JSONEachRow",
        values: params.records,
        datastore_settings: {
          log_comment: JSON.stringify({
            feature: "ingestion",
            type: params.table,
            operation_name: "writeToDatastore",
            projectId: params.records.length > 0 ? params.records[0].project_id : undefined,
          }),
        },
      })
      .catch((err) => {
        logger.error(`DatastoreWriter.writeToDatastore ${err}`);

        throw err;
      });

    logger.debug(`DatastoreWriter.writeToDatastore: ${Date.now() - startTime} ms`);

    recordGauge("ingestion_datastore_insert", params.records.length);
  }
}

export enum TableName {
  Traces = "traces",
  TracesNull = "traces_null",
  Scores = "scores",
  Observations = "observations",
  ObservationsBatchStaging = "observations_batch_staging",
  BlobStorageFileLog = "blob_storage_file_log",
  DatasetRunItems = "dataset_run_items_rmt",
  Events = "events",
}

type RecordInsertType<T extends TableName> = T extends TableName.Scores
  ? ScoreRecordInsertType
  : T extends TableName.Observations
    ? ObservationRecordInsertType
    : T extends TableName.ObservationsBatchStaging
      ? ObservationBatchStagingRecordInsertType
      : T extends TableName.Traces
        ? TraceRecordInsertType
        : T extends TableName.TracesNull
          ? TraceNullRecordInsertType
          : T extends TableName.BlobStorageFileLog
            ? BlobStorageFileLogInsertType
            : T extends TableName.DatasetRunItems
              ? DatasetRunItemRecordInsertType
              : T extends TableName.Events
                ? EventRecordInsertType
                : never;

type DatastoreQueue = {
  [T in TableName]: DatastoreWriterQueueItem<T>[];
};

type DatastoreWriterQueueItem<T extends TableName> = {
  createdAt: number;
  attempts: number;
  data: RecordInsertType<T>;
};
