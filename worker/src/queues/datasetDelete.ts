import { Job, Processor } from "@hanzo/mq";
import { QueueName, TQueueJobTypes } from "@hanzo/shared/src/server";
import { processDatastoreDatasetDelete } from "../features/datasets/processDatastoreDatasetDelete";

export const datasetDeleteProcessor: Processor = async (
  job: Job<TQueueJobTypes[QueueName.DatasetDelete]>,
): Promise<void> => {
  await processDatastoreDatasetDelete(job.data.payload);
};
