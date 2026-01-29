import { env } from "@/src/env.mjs";
import {
  type StorageService,
  StorageServiceFactory,
} from "@hanzo/shared/src/server";

let s3StorageServiceClient: StorageService;

export const getMediaStorageServiceClient = (
  bucketName: string,
): StorageService => {
  if (!s3StorageServiceClient) {
    s3StorageServiceClient = StorageServiceFactory.getInstance({
      bucketName,
      accessKeyId: env.HANZO_S3_MEDIA_UPLOAD_ACCESS_KEY_ID,
      secretAccessKey: env.HANZO_S3_MEDIA_UPLOAD_SECRET_ACCESS_KEY,
      endpoint: env.HANZO_S3_MEDIA_UPLOAD_ENDPOINT,
      region: env.HANZO_S3_MEDIA_UPLOAD_REGION,
      forcePathStyle: env.HANZO_S3_MEDIA_UPLOAD_FORCE_PATH_STYLE === "true",
      awsSse: env.HANZO_S3_MEDIA_UPLOAD_SSE,
      awsSseKmsKeyId: env.HANZO_S3_MEDIA_UPLOAD_SSE_KMS_KEY_ID,
    });
  }
  return s3StorageServiceClient;
};
