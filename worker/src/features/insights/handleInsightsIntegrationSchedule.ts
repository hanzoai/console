import { prisma } from "@hanzo/console-core/src/db";
import { InsightsIntegrationProcessingQueue, QueueJobs, logger } from "@hanzo/console-core/src/server";
import { randomUUID } from "crypto";

export const handleInsightsIntegrationSchedule = async () => {
  const insightsIntegrationProjects = await prisma.insightsIntegration.findMany({
    select: {
      lastSyncAt: true,
      projectId: true,
    },
    where: {
      enabled: true,
    },
  });

  if (insightsIntegrationProjects.length === 0) {
    logger.info("[INSIGHTS] No Insights integrations ready for sync");
    return;
  }

  const insightsIntegrationProcessingQueue = InsightsIntegrationProcessingQueue.getInstance();
  if (!insightsIntegrationProcessingQueue) {
    throw new Error("InsightsIntegrationProcessingQueue not initialized");
  }

  logger.info(`[INSIGHTS] Scheduling ${insightsIntegrationProjects.length} Insights integrations for sync`);

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
        // Deduplicate by projectId + lastSyncAt so the same project isn't queued
        // twice for the same sync window. removeOnFail ensures failed jobs are
        // immediately cleaned up so they don't block re-queuing on the next cycle.
        jobId: `${integration.projectId}-${integration.lastSyncAt?.toISOString() ?? ""}`,
        removeOnFail: true,
      },
    })),
  );
};
