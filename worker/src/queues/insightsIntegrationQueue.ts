import { Processor } from "@hanzo/mq";
import { instrumentAsync, logger, QueueJobs } from "@hanzo/console-core/src/server";
import { handleInsightsIntegrationSchedule } from "../features/insights/handleInsightsIntegrationSchedule";
import { handleInsightsIntegrationProjectJob } from "../features/insights/handleInsightsIntegrationProjectJob";
import { SpanKind } from "@opentelemetry/api";

export const insightsIntegrationProcessor: Processor = async (job) => {
  if (job.name === QueueJobs.InsightsIntegrationJob) {
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
  if (job.name === QueueJobs.InsightsIntegrationProcessingJob) {
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
