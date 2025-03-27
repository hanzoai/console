import { createAuthedAPIRoute } from "@/src/features/public-api/server/createAuthedAPIRoute";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import {
  GetScoreConfigQuery,
  GetScoreConfigResponse,
  InternalServerError,
  HanzoNotFoundError,
} from "@hanzo/shared";
import { prisma } from "@hanzo/shared/src/db";
import { traceException } from "@hanzo/shared/src/server";

export default withMiddlewares({
  GET: createAuthedAPIRoute({
    name: "Get a Score Config",
    querySchema: GetScoreConfigQuery,
    responseSchema: GetScoreConfigResponse,
    fn: async ({ query, auth }) => {
      const config = await prisma.scoreConfig.findUnique({
        where: {
          id: query.configId,
          projectId: auth.scope.projectId,
        },
      });

      if (!config) {
        throw new HanzoNotFoundError(
          "Score config not found within authorized project",
        );
      }

      const parsedConfig = GetScoreConfigResponse.safeParse(config);
      if (!parsedConfig.success) {
        traceException(parsedConfig.error);
        throw new InternalServerError("Requested score config is corrupted");
      }

      return parsedConfig.data;
    },
  }),
});
