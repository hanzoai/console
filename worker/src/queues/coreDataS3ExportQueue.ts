import { Processor } from "bullmq";
import { logger, StorageService, StorageServiceFactory } from "@hanzo/shared/src/server";
import { prisma } from "@hanzo/shared/src/db";
import { env } from "../env";

let s3StorageServiceClient: StorageService;

const getS3StorageServiceClient = (bucketName: string): StorageService => {
  if (!s3StorageServiceClient) {
    s3StorageServiceClient = StorageServiceFactory.getInstance({
      bucketName,
      accessKeyId: env.HANZO_S3_CORE_DATA_UPLOAD_ACCESS_KEY_ID,
      secretAccessKey: env.HANZO_S3_CORE_DATA_UPLOAD_SECRET_ACCESS_KEY,
      endpoint: env.HANZO_S3_CORE_DATA_UPLOAD_ENDPOINT,
      region: env.HANZO_S3_CORE_DATA_UPLOAD_REGION,
      forcePathStyle: env.HANZO_S3_CORE_DATA_UPLOAD_FORCE_PATH_STYLE === "true",
      awsSse: env.HANZO_S3_CORE_DATA_UPLOAD_SSE,
      awsSseKmsKeyId: env.HANZO_S3_CORE_DATA_UPLOAD_SSE_KMS_KEY_ID,
    });
  }
  return s3StorageServiceClient;
};

export const coreDataS3ExportProcessor: Processor = async (): Promise<void> => {
  if (!env.HANZO_S3_CORE_DATA_UPLOAD_BUCKET) {
    logger.error("No bucket name provided for core data S3 export");
    throw new Error("Must provide HANZO_S3_CORE_DATA_UPLOAD_BUCKET to use core data S3 exports");
  }

  logger.info("Starting core data S3 export");

  const s3Client = getS3StorageServiceClient(env.HANZO_S3_CORE_DATA_UPLOAD_BUCKET);

  // Fetch table data
  const [projects, users, organizations, orgMemberships, projectMemberships, prompts, billingMeterBackup, surveys] =
    await Promise.all([
      prisma.project.findMany({
        select: {
          id: true,
          name: true,
          orgId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          admin: true,
          email: true,
          featureFlags: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.organization.findMany({
        select: {
          id: true,
          name: true,
          cloudConfig: true,
          // Remove both createdAt and updatedAt as they're not in the OrganizationSelect type
        },
      }),
      prisma.organizationMembership.findMany({
        select: {
          id: true,
          role: true,
          orgId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.projectMembership.findMany({
        select: {
          role: true,
          projectId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.prompt.findMany({
        select: {
          id: true,
          name: true,
          projectId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.billingMeterBackup.findMany(),
      prisma.survey.findMany({
        select: {
          id: true,
          surveyName: true,
          response: true,
          userId: true,
          userEmail: true,
          orgId: true,
          createdAt: true,
        },
      }),
    ]);

  // Iterate through the tables and upload them to S3 as JSONLs
  await Promise.all(
    Object.entries({
      projects,
      users,
      organizations,
      orgMemberships,
      projectMemberships,
      prompts,
      billingMeterBackup,
      surveys,
    }).map(async ([key, value]) =>
      s3Client.uploadFile({
        fileName: `${env.HANZO_S3_CORE_DATA_UPLOAD_PREFIX}${key}.jsonl`,
        fileType: "application/x-ndjson",
        data: value.map((item) => JSON.stringify(item)).join("\n"),
      }),
    ),
  );

  logger.info("Finished core data S3 export");
};
