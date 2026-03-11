import { Queue } from "@hanzo/mq";
import { QueueName, QueueJobs } from "../queues";
import { createNewRedisInstance, redisQueueRetryOptions, getQueuePrefix } from "./redis";
import { logger } from "../logger";

export const INSIGHTS_SYNC_CRON_PATTERN = "0 * * * *"; // every hour at :00

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
      ? new Queue(QueueName.InsightsIntegrationQueue, {
          connection: newRedis,
          prefix: getQueuePrefix(QueueName.InsightsIntegrationQueue),
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
          QueueJobs.InsightsIntegrationJob,
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
