import { logger } from "@hanzo/shared/src/server";

export async function handlePostHogIntegrationProjectJob() {
  logger.info("PostHog integration project job is a no-op in this build");
  return { success: true };
}
