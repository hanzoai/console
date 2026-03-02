/**
 * @hanzo/datastore — Native HTTP client for the Hanzo Datastore.
 *
 * Speaks the Datastore HTTP interface directly via native fetch.
 * Zero external dependencies. ZAP binary transport is planned as next transport layer.
 *
 * Auth: X-Datastore-User / X-Datastore-Key headers.
 * Format: JSONEachRow for selects, JSON newline-delimited for inserts.
 */

import { env } from "../../env";
import { getCurrentSpan } from "../instrumentation";
import { propagation, context } from "@opentelemetry/api";
import { DatastoreLogger } from "./datastore-logger";
import type { DatastoreClientConfig, DatastoreSettings, InsertResult, CommandResult } from "./types";

export type { DatastoreClientConfig, DatastoreSettings, InsertResult, CommandResult };
export { DatastoreLogLevel } from "./types";

// ---------------------------------------------------------------------------
// Type aliases for API compatibility
// ---------------------------------------------------------------------------
export type NodeDatastoreClientConfigOptions = DatastoreClientConfig;

export type PreferredDatastoreService = "ReadWrite" | "ReadOnly" | "EventsReadOnly";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQueryParams(
  params: Record<string, unknown> | undefined,
  settings: DatastoreSettings,
  database: string,
): URLSearchParams {
  const qs = new URLSearchParams();
  qs.set("database", database);
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined && value !== null) {
      qs.set(key, String(value));
    }
  }
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        qs.set(`param_${key}`, `[${value.map((v) => `'${String(v)}'`).join(",")}]`);
      } else {
        qs.set(`param_${key}`, String(value ?? ""));
      }
    }
  }
  return qs;
}

function parseJSONEachRow<T>(text: string): T[] {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  // Detect non-JSON response (e.g. ClickHouse error or TabSeparated format).
  // JSONEachRow lines always start with '{'.
  const firstLine = lines[0].trimStart();
  if (firstLine.length > 0 && firstLine[0] !== "{") {
    throw new Error(
      `Datastore returned non-JSON response (expected JSONEachRow). First line: ${firstLine.slice(0, 200)}`,
    );
  }

  return lines.map((line, idx) => {
    try {
      return JSON.parse(line) as T;
    } catch (e) {
      throw new Error(
        `Failed to parse JSONEachRow at line ${idx + 1}/${lines.length}: ${(e as Error).message}. Line: ${line.slice(0, 200)}`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// DatastoreClient
// ---------------------------------------------------------------------------

export class DatastoreClient {
  private readonly url: string;
  private readonly username: string;
  private readonly password: string;
  private readonly database: string;
  private readonly requestTimeout: number;
  private readonly httpHeaders: Record<string, string>;
  private readonly settings: DatastoreSettings;
  // Logger kept for API surface compatibility
  private readonly _logger = new DatastoreLogger();

  constructor(config: DatastoreClientConfig = {}) {
    this.url = (config.url ?? "http://localhost:8123").replace(/\/$/, "");
    this.username = config.username ?? "default";
    this.password = config.password ?? "";
    this.database = config.database ?? "default";
    this.requestTimeout = config.request_timeout ?? 30_000;
    this.httpHeaders = config.http_headers ?? {};
    this.settings = config.datastore_settings ?? {};
  }

  private authHeaders(): Record<string, string> {
    return {
      "X-Datastore-User": this.username,
      "X-Datastore-Key": this.password,
      "X-Datastore-Database": this.database,
    };
  }

  private otelHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const activeSpan = getCurrentSpan();
    if (activeSpan) {
      propagation.inject(context.active(), headers);
    }
    return headers;
  }

  private baseHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      ...this.authHeaders(),
      ...this.otelHeaders(),
      ...this.httpHeaders,
      ...extra,
    };
  }

  /**
   * Execute a SELECT query. Returns an object with `.json()` for API compat.
   */
  async query<T = Record<string, unknown>>(opts: {
    query: string;
    query_params?: Record<string, unknown>;
    datastore_settings?: DatastoreSettings;
    abort_signal?: AbortSignal;
    http_headers?: Record<string, string>;
    format?: string; // accepted for compat, always uses JSONEachRow
  }): Promise<{
    query_id: string;
    response_headers: Record<string, string>;
    json: <R = T>() => Promise<{ data: R[] }>;
    text: () => Promise<string>;
    stream: <R = T>() => AsyncIterable<{ json: () => R }[]>;
  }> {
    const mergedSettings: DatastoreSettings = { ...this.settings, ...opts.datastore_settings };
    const qs = buildQueryParams(opts.query_params, mergedSettings, this.database);
    const url = `${this.url}/?${qs.toString()}`;
    const sql = `${opts.query.trimEnd().replace(/;+$/, "")} FORMAT JSONEachRow`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
    opts.abort_signal?.addEventListener("abort", () => controller.abort());

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.baseHeaders({
          "Content-Type": "text/plain; charset=utf-8",
          ...(opts.http_headers ?? {}),
        }),
        body: sql,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const msg = await response.text();
        throw new Error(`Datastore query error (${response.status}): ${msg}`);
      }

      const text = await response.text();
      const queryId = response.headers.get("x-datastore-query-id") ?? crypto.randomUUID();
      // Collect all headers into a plain object
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        responseHeaders[k] = v;
      });
      const rows = parseJSONEachRow<T>(text);

      return {
        query_id: queryId,
        response_headers: responseHeaders,
        json: async <R = T>() => ({ data: rows as unknown as R[] }),
        // text compat shim — returns tab-separated rows
        text: async () => rows.map((row) => Object.values(row as Record<string, unknown>).join("\t")).join("\n"),
        // stream compatibility shim — yields one chunk with all rows
        stream: async function* <R = T>() {
          yield rows.map((row) => ({ json: () => row as unknown as R }));
        },
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Stream a SELECT query row-by-row.
   */
  async *stream<T = Record<string, unknown>>(opts: {
    query: string;
    query_params?: Record<string, unknown>;
    datastore_settings?: DatastoreSettings;
  }): AsyncGenerator<T> {
    const mergedSettings: DatastoreSettings = { ...this.settings, ...opts.datastore_settings };
    const qs = buildQueryParams(opts.query_params, mergedSettings, this.database);
    const url = `${this.url}/?${qs.toString()}`;
    const sql = `${opts.query.trimEnd().replace(/;+$/, "")} FORMAT JSONEachRow`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.baseHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
      body: sql,
    });

    if (!response.ok) {
      const msg = await response.text();
      throw new Error(`Datastore stream error (${response.status}): ${msg}`);
    }
    if (!response.body) throw new Error("Datastore: response body is null");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) yield JSON.parse(line) as T;
        }
      }
      if (buffer.trim()) yield JSON.parse(buffer) as T;
    } finally {
      reader.cancel();
    }
  }

  /**
   * INSERT rows using JSONEachRow format.
   */
  async insert<T extends Record<string, unknown>>(opts: {
    table: string;
    values: T[];
    datastore_settings?: DatastoreSettings;
    format?: string; // accepted for compat, always uses JSONEachRow
  }): Promise<InsertResult & { response_headers: Record<string, string> }> {
    const mergedSettings: DatastoreSettings = {
      async_insert: 1,
      wait_for_async_insert: 1,
      ...this.settings,
      ...opts.datastore_settings,
    };
    const qs = buildQueryParams(undefined, mergedSettings, this.database);
    qs.set("query", `INSERT INTO ${opts.table} FORMAT JSONEachRow`);
    const url = `${this.url}/?${qs.toString()}`;
    const body = opts.values.map((row) => JSON.stringify(row)).join("\n");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.baseHeaders({ "Content-Type": "application/x-ndjson" }),
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const msg = await response.text();
        throw new Error(`Datastore insert error (${response.status}): ${msg}`);
      }

      const queryId = response.headers.get("x-datastore-query-id") ?? crypto.randomUUID();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        responseHeaders[k] = v;
      });
      return { query_id: queryId, executed: true, response_headers: responseHeaders };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Execute a DDL/DML command (no result rows expected).
   */
  async command(opts: {
    query: string;
    query_params?: Record<string, unknown>;
    datastore_settings?: DatastoreSettings;
    session_id?: string;
  }): Promise<CommandResult> {
    const mergedSettings: DatastoreSettings = { ...this.settings, ...opts.datastore_settings };
    const qs = buildQueryParams(opts.query_params, mergedSettings, this.database);
    if (opts.session_id) qs.set("session_id", opts.session_id);
    const url = `${this.url}/?${qs.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.baseHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
        body: opts.query,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const msg = await response.text();
        throw new Error(`Datastore command error (${response.status}): ${msg}`);
      }

      const queryId = response.headers.get("x-datastore-query-id") ?? crypto.randomUUID();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        responseHeaders[k] = v;
      });
      return { query_id: queryId, response_headers: responseHeaders };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /** Health-check the datastore. */
  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.url}/ping`, {
        method: "GET",
        headers: this.authHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** No-op for fetch-based client (kept for API compat). */
  async close(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// DatastoreClientManager — singleton, keyed connection pool
// ---------------------------------------------------------------------------

export class DatastoreClientManager {
  private static instance: DatastoreClientManager;
  private clientMap = new Map<string, DatastoreClient>();

  private constructor() {}

  static getInstance(): DatastoreClientManager {
    if (!DatastoreClientManager.instance) {
      DatastoreClientManager.instance = new DatastoreClientManager();
    }
    return DatastoreClientManager.instance;
  }

  private getUrl(tier: PreferredDatastoreService): string | undefined {
    switch (tier) {
      case "ReadWrite":
        return env.DATASTORE_URL;
      case "EventsReadOnly":
        return env.DATASTORE_EVENTS_READ_ONLY_URL ?? env.DATASTORE_READ_ONLY_URL ?? env.DATASTORE_URL;
      case "ReadOnly":
      default:
        return env.DATASTORE_READ_ONLY_URL ?? env.DATASTORE_URL;
    }
  }

  getClient(opts: DatastoreClientConfig = {}, tier: PreferredDatastoreService = "ReadWrite"): DatastoreClient {
    const config: DatastoreClientConfig = {
      url: this.getUrl(tier),
      username: env.DATASTORE_USER,
      password: env.DATASTORE_PASSWORD,
      database: env.DATASTORE_DB ?? "default",
      request_timeout: opts.request_timeout,
      http_headers: opts.http_headers ?? {},
      datastore_settings: {
        ...(env.DATASTORE_ASYNC_INSERT_MAX_DATA_SIZE
          ? { async_insert_max_data_size: env.DATASTORE_ASYNC_INSERT_MAX_DATA_SIZE }
          : {}),
        ...(env.DATASTORE_ASYNC_INSERT_BUSY_TIMEOUT_MS
          ? { async_insert_busy_timeout_ms: env.DATASTORE_ASYNC_INSERT_BUSY_TIMEOUT_MS }
          : {}),
        ...(env.DATASTORE_ASYNC_INSERT_BUSY_TIMEOUT_MIN_MS
          ? { async_insert_busy_timeout_min_ms: env.DATASTORE_ASYNC_INSERT_BUSY_TIMEOUT_MIN_MS }
          : {}),
        ...opts.datastore_settings,
        async_insert: 1,
        wait_for_async_insert: 1,
      },
    };

    const key = JSON.stringify({
      url: config.url,
      username: config.username,
      database: config.database,
      headers: opts.http_headers,
    });

    if (!this.clientMap.has(key)) {
      this.clientMap.set(key, new DatastoreClient(config));
    }

    return this.clientMap.get(key)!;
  }

  async closeAllConnections(): Promise<void[]> {
    const p = Array.from(this.clientMap.values()).map((c) => c.close());
    this.clientMap.clear();
    return Promise.all(p);
  }
}

// ---------------------------------------------------------------------------
// Public factory function
// ---------------------------------------------------------------------------

export const datastoreClient = (
  opts?: DatastoreClientConfig,
  tier: PreferredDatastoreService = "ReadWrite",
): DatastoreClient => DatastoreClientManager.getInstance().getClient(opts ?? {}, tier);

/**
 * Format a JS Date as a datastore DateTime string.
 * 2024-11-06T20:37:00.123Z → "2024-11-06 20:37:00.123"
 */
export const convertDateToDatastoreDateTime = (date: Date): string =>
  date.toISOString().replace("T", " ").replace("Z", "");
