import { logger } from "@hanzo/shared/src/server";

export async function handleCloudUsageMeteringJob() {
  logger.info("Cloud usage metering job is a no-op in this build");
  return { success: true };
}
