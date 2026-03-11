import {
  deleteScores,
  logger,
  traceException,
  deleteIngestionEventsFromS3AndDatastoreForScores,
} from "@hanzo/console-core/src/server";
import { env } from "../../env";

export const processDatastoreScoreDelete = async (projectId: string, scoreIds: string[]) => {
  logger.info(`Deleting scores ${JSON.stringify(scoreIds)} in project ${projectId} from Datastore and S3`);

  try {
    await Promise.all([
      env.HANZO_ENABLE_BLOB_STORAGE_FILE_LOG === "true"
        ? deleteIngestionEventsFromS3AndDatastoreForScores({
            projectId,
            scoreIds,
          })
        : Promise.resolve(),
      deleteScores(projectId, scoreIds),
    ]);
  } catch (e) {
    logger.error(`Error deleting scores ${JSON.stringify(scoreIds)} in project ${projectId} from Datastore`, e);
    traceException(e);
    throw e;
  }
};
