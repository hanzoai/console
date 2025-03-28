import { logger } from "@hanzo/shared/src/server";

export async function handleDataRetentionProcessingJob() {
  logger.info("Data retention processing job is a no-op in this build");
  return { success: true };
}
