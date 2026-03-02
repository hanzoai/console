import { Queue } from "bullmq";
import { QueueName, QueueJobs } from "../queues";
import { createNewRedisInstance, redisQueueRetryOptions, getQueuePrefix } from "./redis";
import { logger } from "../logger";

export const INSIGHTS_SYNC_CRON_PATTERN = "30 * * * *"; // every hour at :30

export class InsightsIntegrationQueue {
  private static instance: Queue | null = null;

  public static getInstance(): Queue | null {
    if (InsightsIntegrationQueue.instance) {
      return InsightsIntegrationQueue.instance;
    }

    const newRedis = createNewRedisInstance({
      enableOfflineQueue: false,
      ...redisQueueRetryOptions,
    });

    InsightsIntegrationQueue.instance = newRedis
      ? new Queue(QueueName.PostHogIntegrationQueue, {
          connection: newRedis,
          prefix: getQueuePrefix(QueueName.PostHogIntegrationQueue),
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: 100,
            attempts: 5,
            backoff: {
              type: "exponential",
              delay: 5000,
            },
          },
        })
      : null;

    InsightsIntegrationQueue.instance?.on("error", (err) => {
      logger.error("InsightsIntegrationQueue error", err);
    });

    if (InsightsIntegrationQueue.instance) {
      logger.debug("Scheduling jobs for InsightsIntegrationQueue");
      InsightsIntegrationQueue.instance
        .add(
          QueueJobs.PostHogIntegrationJob,
          {},
          {
            repeat: { pattern: INSIGHTS_SYNC_CRON_PATTERN },
          },
        )
        .catch((err) => {
          logger.error("Error adding InsightsIntegrationJob schedule", err);
        });
    }

    return InsightsIntegrationQueue.instance;
  }
}

// Backward-compat alias
export { InsightsIntegrationQueue as PostHogIntegrationQueue };
// Backward-compat cron pattern alias
export { INSIGHTS_SYNC_CRON_PATTERN as POSTHOG_SYNC_CRON_PATTERN };
