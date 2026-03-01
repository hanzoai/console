/**
 * @hanzo/datastore — Native Hanzo Datastore types.
 * No external ClickHouse client dependencies. Uses HTTP API directly via fetch.
 * ZAP binary protocol support is planned as a future transport layer.
 */

// ---------------------------------------------------------------------------
// Log level
// ---------------------------------------------------------------------------

export enum DatastoreLogLevel {
  TRACE = "TRACE",
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  OFF = "OFF",
}

// ---------------------------------------------------------------------------
// Settings passed per-query (maps to ClickHouse HTTP query params)
// ---------------------------------------------------------------------------

export interface DatastoreSettings {
  /** Async insert — batch writes for throughput */
  async_insert?: 0 | 1;
  wait_for_async_insert?: 0 | 1;
  async_insert_max_data_size?: string;
  async_insert_busy_timeout_ms?: number;
  async_insert_busy_timeout_min_ms?: number;
  /** Delete / update modes */
  lightweight_delete_mode?: "alter_update" | "lightweight_update" | "lightweight_update_force";
  update_parallel_mode?: "sync" | "async" | "auto";
  /** Progress reporting over HTTP */
  send_progress_in_http_headers?: 0 | 1;
  http_headers_progress_interval_ms?: string;
  /** Input format */
  input_format_json_throw_on_bad_escape_sequence?: 0 | 1;
  /** Allow arbitrary extra settings */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

export interface DatastoreClientConfig {
  /** Base URL of the Hanzo Datastore HTTP endpoint (e.g. http://localhost:8123) */
  url?: string;
  username?: string;
  password?: string;
  database?: string;
  /** Request timeout in milliseconds */
  request_timeout?: number;
  /** Per-request HTTP headers */
  http_headers?: Record<string, string>;
  /** Default query settings */
  clickhouse_settings?: DatastoreSettings;
  /** Keep-alive configuration */
  keep_alive?: { idle_socket_ttl?: number };
  max_open_connections?: number;
}

// ---------------------------------------------------------------------------
// Query result types
// ---------------------------------------------------------------------------

/** Raw result row as returned by the datastore */
export type DatastoreRow = Record<string, unknown>;

export interface InsertResult {
  query_id: string;
  executed: boolean;
  response_headers?: Record<string, string>;
}

export interface CommandResult {
  query_id: string;
  response_headers?: Record<string, string>;
}
