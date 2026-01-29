/**
 * Metering data Postgres export - stub for community edition.
 * This feature is only available in the enterprise/cloud edition.
 */

import { Processor } from "bullmq";
import { logger } from "@hanzo/shared/src/server";

export const meteringDataPostgresExportProcessor: Processor = async (): Promise<void> => {
  logger.debug("[METERING POSTGRES EXPORT] Metering data export is not available in community edition");
  return;
};
