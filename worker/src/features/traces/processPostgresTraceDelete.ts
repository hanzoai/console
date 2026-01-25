import { prisma } from "@hanzo/shared/src/db";
import { logger, traceException } from "@hanzo/shared/src/server";

export const processPostgresTraceDelete = async (
  projectId: string,
  traceIds: string[],
) => {
  logger.info(
    `Deleting traces ${JSON.stringify(traceIds)} in project ${projectId} from Postgres`,
  );
  try {
    await prisma.jobExecution.deleteMany({
      where: {
        jobInputTraceId: {
          in: traceIds,
        },
        projectId: projectId,
      },
    });
  } catch (e) {
    logger.error(
      `Error deleting trace ${JSON.stringify(traceIds)} in project ${projectId} from Postgres`,
      e,
    );
    traceException(e);
    throw e;
  }
};
