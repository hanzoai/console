import { logger } from "@hanzo/shared/src/server";

export async function handleDataRetentionSchedule() {
  logger.info("Data retention schedule is a no-op in this build");
  return { success: true };
}
