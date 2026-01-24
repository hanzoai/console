/**
 * Cloud free tier usage threshold job - stub for community edition.
 * This feature is only available in the enterprise/cloud edition.
 */

import { logger } from "@langfuse/shared/src/server";
import { Job } from "bullmq";

export const handleCloudFreeTierUsageThresholdJob = async (job: Job) => {
  logger.debug(
    "[FREE TIER USAGE THRESHOLDS] Usage thresholds are not available in community edition",
    { jobId: job.id }
  );
  return;
};
