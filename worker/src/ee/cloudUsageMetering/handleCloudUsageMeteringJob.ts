/**
 * Cloud usage metering - stub for community edition.
 * This feature is only available in the enterprise/cloud edition.
 */

import { Job } from "bullmq";
import { logger } from "@hanzo/shared/src/server";

export const handleCloudUsageMeteringJob = async (job: Job) => {
  logger.debug(
    "[CLOUD USAGE METERING] Cloud usage metering is not available in community edition",
    { jobId: job.id }
  );
  return;
};
