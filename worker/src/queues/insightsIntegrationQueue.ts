import { Processor } from "bullmq";
import { instrumentAsync, logger, QueueJobs } from "@hanzo/shared/src/server";
import { handleInsightsIntegrationSchedule } from "../features/insights/handlePostHogIntegrationSchedule";
import { handleInsightsIntegrationProjectJob } from "../features/insights/handlePostHogIntegrationProjectJob";
import { SpanKind } from "@opentelemetry/api";

export const insightsIntegrationProcessor: Processor = async (job) => {
  if (job.name === QueueJobs.PostHogIntegrationJob) {
    logger.info("Executing Hanzo Insights Integration Job");
    try {
      return await handleInsightsIntegrationSchedule();
    } catch (error) {
      logger.error("Error executing InsightsIntegrationJob", error);
      throw error;
    }
  }
};

export const insightsIntegrationProcessingProcessor: Processor = async (job) => {
  if (job.name === QueueJobs.PostHogIntegrationProcessingJob) {
    return await instrumentAsync(
      {
        name: "process insights-integration-project",
        startNewTrace: true,
        spanKind: SpanKind.CONSUMER,
      },
      async () => {
        try {
          return await handleInsightsIntegrationProjectJob(job);
        } catch (error) {
          logger.error("Error executing InsightsIntegrationProcessingJob", error);
          throw error;
        }
      },
    );
  }
};

// Backward-compat aliases so existing imports of postHogIntegration* still compile
export {
  insightsIntegrationProcessor as postHogIntegrationProcessor,
  insightsIntegrationProcessingProcessor as postHogIntegrationProcessingProcessor,
};
