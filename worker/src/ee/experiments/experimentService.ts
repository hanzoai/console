import { logger } from "@hanzo/shared/src/server";

export async function createExperimentJob() {
  logger.info("Create experiment job is a no-op in this build");
  return { success: true };
}
