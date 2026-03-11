import { Job, Processor } from "@hanzo/mq";
import { QueueName, TQueueJobTypes } from "@hanzo/console-core/src/server";

import { processDatastoreScoreDelete } from "../features/scores/processDatastoreScoreDelete";

export const scoreDeleteProcessor: Processor = async (
  job: Job<TQueueJobTypes[QueueName.ScoreDelete]>,
): Promise<void> => {
  const { scoreIds, projectId } = job.data.payload;
  await processDatastoreScoreDelete(projectId, scoreIds);
};
