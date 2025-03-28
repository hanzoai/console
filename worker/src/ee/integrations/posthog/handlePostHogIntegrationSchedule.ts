import { logger } from "@hanzo/shared/src/server";

export async function handlePostHogIntegrationSchedule() {
  logger.info("PostHog integration schedule is a no-op in this build");
  return { success: true };
}
