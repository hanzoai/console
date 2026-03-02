import { expect, describe, it, beforeAll } from "vitest";
import {
  datastoreClient,
  createOrgProjectAndApiKey,
  createTraceScore,
  createScoresCh,
  getBlobStorageByProjectId,
  getScoresByIds,
  StorageService,
  StorageServiceFactory,
} from "@hanzo/shared/src/server";
import { randomUUID } from "crypto";
import { env } from "../env";
import { processDatastoreScoreDelete } from "../features/scores/processDatastoreScoreDelete";

describe("score deletion", () => {
  let eventStorageService: StorageService;

  beforeAll(() => {
    eventStorageService = StorageServiceFactory.getInstance({
      accessKeyId: env.S3_EVENT_UPLOAD_ACCESS_KEY_ID,
      secretAccessKey: env.S3_EVENT_UPLOAD_SECRET_ACCESS_KEY,
      bucketName: env.S3_EVENT_UPLOAD_BUCKET,
      endpoint: env.S3_EVENT_UPLOAD_ENDPOINT,
      region: env.S3_EVENT_UPLOAD_REGION,
      forcePathStyle: env.S3_EVENT_UPLOAD_FORCE_PATH_STYLE === "true",
    });
  });

  it("should delete all scores from Datastore", async () => {
    // Setup
    const { projectId } = await createOrgProjectAndApiKey();

    const score = createTraceScore({ project_id: projectId });
    await createScoresCh([score]);

    // When
    await processDatastoreScoreDelete(projectId, [score.id]);

    // Then
    const scores = await getScoresByIds(projectId, [score.id]);
    expect(scores).toHaveLength(0);
  });

  it("should delete S3 event files for deleted scores", async () => {
    // Setup
    const { projectId } = await createOrgProjectAndApiKey();

    const scoreId = randomUUID();
    await createScoresCh([createTraceScore({ id: scoreId, project_id: projectId })]);

    const fileType = "application/json";
    const data = JSON.stringify({ hello: "world" });

    await Promise.all([
      eventStorageService.uploadFile({
        fileName: `${projectId}/score/${scoreId}-score.json`,
        fileType,
        data,
      }),
    ]);

    await datastoreClient().insert({
      table: "blob_storage_file_log",
      format: "JSONEachRow",
      values: [
        {
          id: randomUUID(),
          project_id: projectId,
          entity_type: "score",
          entity_id: scoreId,
          event_id: randomUUID(),
          bucket_name: env.S3_EVENT_UPLOAD_BUCKET,
          bucket_path: `${projectId}/score/${scoreId}-score.json`,
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
        },
      ],
    });

    // When
    await processDatastoreScoreDelete(projectId, [scoreId]);

    // Then
    const eventLog = getBlobStorageByProjectId(projectId);
    for await (const _ of eventLog) {
      // Should never happen as the expect event log to be empty
      expect(true).toBe(false);
    }

    const files = await eventStorageService.listFiles(projectId);
    expect(files).toHaveLength(0);
  });
});
