import { Queue } from "@hanzo/mq";
import { QueueName } from "../queues";
import { createNewRedisInstance, redisQueueRetryOptions, getQueuePrefix } from "./redis";
import { logger } from "../logger";

export class InsightsIntegrationProcessingQueue {
  private static instance: Queue | null = null;

  public static getInstance(): Queue | null {
    if (InsightsIntegrationProcessingQueue.instance) {
      return InsightsIntegrationProcessingQueue.instance;
    }

    const newRedis = createNewRedisInstance({
      enableOfflineQueue: false,
      ...redisQueueRetryOptions,
    });

    InsightsIntegrationProcessingQueue.instance = newRedis
      ? new Queue(QueueName.PostHogIntegrationProcessingQueue, {
          connection: newRedis,
          prefix: getQueuePrefix(QueueName.PostHogIntegrationProcessingQueue),
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: 100_000,
            attempts: 5,
            backoff: {
              type: "exponential",
              delay: 5000,
            },
          },
        })
      : null;

    InsightsIntegrationProcessingQueue.instance?.on("error", (err) => {
      logger.error("InsightsIntegrationProcessingQueue error", err);
    });

    return InsightsIntegrationProcessingQueue.instance;
  }
}

// Backward-compat alias
export { InsightsIntegrationProcessingQueue as PostHogIntegrationProcessingQueue };
