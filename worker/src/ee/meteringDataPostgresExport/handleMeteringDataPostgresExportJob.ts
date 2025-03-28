import { logger } from "@hanzo/shared/src/server";

export const meteringDataPostgresExportProcessor = {
  process: async () => {
    logger.info("Metering data postgres export is a no-op in this build");
    return { success: true };
  }
};