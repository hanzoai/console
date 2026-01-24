/**
 * Cloud spend alerts - stub for community edition.
 * This feature is only available in the enterprise/cloud edition.
 */

import { Job } from "bullmq";
import { logger } from "@langfuse/shared/src/server";

export const handleCloudSpendAlertJob = async (job: Job<{ orgId: string }>) => {
  logger.debug(
    "[CLOUD SPEND ALERTS] Cloud spend alerts are not available in community edition",
    { orgId: job.data.orgId }
  );
  return;
};
