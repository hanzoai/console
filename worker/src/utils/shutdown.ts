import { DatastoreClientManager, logger } from "@hanzo/console-core/src/server";
import { redis } from "@hanzo/console-core/src/server";

import { DatastoreWriter } from "../services/DatastoreWriter";
import { setSigtermReceived } from "../features/health";
import { server } from "../index";
import { freeAllTokenizers } from "../features/tokenisation/usage";
import { getTokenCountWorkerManager } from "../features/tokenisation/async-usage";
import { WorkerManager } from "../queues/workerManager";
import { prisma } from "@hanzo/console-core/src/db";
import { BackgroundMigrationManager } from "../backgroundMigrations/backgroundMigrationManager";
import {
  batchProjectCleaners,
  batchDataRetentionCleaners,
  mediaRetentionCleaner,
  batchTraceDeletionCleaner,
} from "../app";

export const onShutdown: NodeJS.SignalsListener = async (signal) => {
  logger.info(`Received ${signal}, closing server...`);
  setSigtermReceived();

  // Stop accepting new connections
  server.close();
  logger.info("Server has been closed.");

  // Stop batch project cleaners
  for (const cleaner of batchProjectCleaners) {
    cleaner.stop();
  }

  // Stop batch data retention cleaners
  for (const cleaner of batchDataRetentionCleaners) {
    cleaner.stop();
  }

  // Stop media retention cleaner
  mediaRetentionCleaner?.stop();

  // Stop batch trace deletion cleaner
  batchTraceDeletionCleaner?.stop();

  // Shutdown workers (https://docs.bullmq.io/guide/going-to-production#gracefully-shut-down-workers)
  await WorkerManager.closeWorkers();

  // Shutdown background migrations
  await BackgroundMigrationManager.close();

  // Flush all pending writes to Datastore AFTER closing ingestion queue worker that is writing to it
  await DatastoreWriter.getInstance().shutdown();
  logger.info("Datastore writer has been shut down.");

  redis?.disconnect();
  logger.info("Redis connection has been closed.");

  await prisma.$disconnect();
  logger.info("Prisma connection has been closed.");

  // Shutdown datastore connections
  await DatastoreClientManager.getInstance().closeAllConnections();

  // Shutdown tokenization worker threads
  try {
    await getTokenCountWorkerManager().terminate();
    logger.info("Token count worker threads have been terminated.");
  } catch (error) {
    logger.error("Error terminating token count worker threads", error);
  }

  freeAllTokenizers();
  logger.info("All tokenizers are cleaned up from memory.");

  logger.info("Shutdown complete, exiting process...");
};
