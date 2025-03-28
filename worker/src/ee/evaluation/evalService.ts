import { logger } from "@hanzo/shared/src/server";

export async function createEvalJobs() {
  logger.info("Create eval jobs is a no-op in this build");
  return { success: true };
}

export async function evaluate() {
  logger.info("Evaluate is a no-op in this build");
  return { success: true };
}
