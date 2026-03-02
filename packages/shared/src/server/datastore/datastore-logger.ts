/**
 * DatastoreLogger — bridges Hanzo Datastore log events to Winston.
 * No @datastore/client dependency — all types defined here.
 */

import { logger as winstonLogger } from "../logger";
import { DatastoreLogLevel } from "./types";

interface LogParams {
  module: string;
  message: string;
  args?: Record<string, unknown>;
}
type ErrorLogParams = LogParams & { err: Error };
type WarnLogParams = LogParams & { err?: Error };

export class DatastoreLogger {
  trace({ module, message, args }: LogParams): void {
    winstonLogger.info(`[${module}] ${message}`, args);
  }
  debug({ module, message, args }: LogParams): void {
    winstonLogger.info(`[${module}] ${message}`, args);
  }
  info({ module, message, args }: LogParams): void {
    winstonLogger.info(`[${module}] ${message}`, args);
  }
  warn({ module, message, args, err }: WarnLogParams): void {
    winstonLogger.warn(`[${module}] ${message}`, {
      ...args,
      ...(err ? { error: err.message, stack: err.stack } : {}),
    });
  }
  error({ module, message, args, err }: ErrorLogParams): void {
    winstonLogger.error(`[${module}] ${message}`, {
      ...args,
      error: err.message,
      stack: err.stack,
    });
  }
}

export const mapLogLevel = (level: string): DatastoreLogLevel => {
  switch (level.toLowerCase()) {
    case "error":
      return DatastoreLogLevel.ERROR;
    case "warn":
      return DatastoreLogLevel.WARN;
    case "info":
      return DatastoreLogLevel.INFO;
    case "debug":
      return DatastoreLogLevel.DEBUG;
    case "trace":
      return DatastoreLogLevel.TRACE;
    default:
      return DatastoreLogLevel.OFF;
  }
};
