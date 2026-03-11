import { Job } from "@hanzo/mq";
import { prisma } from "@hanzo/console-core/src/db";
import { InsightsIntegrationProcessingQueue, QueueJobs } from "@hanzo/console-core/src/server";
import { randomUUID } from "crypto";

export const handleInsightsIntegrationSchedule = async (_job: Job) => {
  const insightsIntegrationProjects = await prisma.insightsIntegration.findMany({
    select: {
      lastSyncAt: true,
      projectId: true,
    },
    where: {
      enabled: true,
    },
  });

  const insightsIntegrationProcessingQueue = InsightsIntegrationProcessingQueue.getInstance();
  if (!insightsIntegrationProcessingQueue) {
    throw new Error("InsightsIntegrationProcessingQueue not initialized");
  }

  await insightsIntegrationProcessingQueue.addBulk(
    insightsIntegrationProjects.map((integration) => ({
      name: QueueJobs.InsightsIntegrationProcessingJob,
      data: {
        id: randomUUID(),
        name: QueueJobs.InsightsIntegrationProcessingJob,
        timestamp: new Date(),
        payload: {
          projectId: integration.projectId,
        },
      },
      opts: {
        // Use projectId and last sync as jobId to prevent duplicate jobs.
        jobId: `${integration.projectId}-${integration.lastSyncAt?.toISOString() ?? ""}`,
      },
    })),
  );
};
