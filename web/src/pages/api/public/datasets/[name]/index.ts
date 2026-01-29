import { prisma } from "@hanzo/shared/src/db";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedProjectAPIRoute } from "@/src/features/public-api/server/createAuthedProjectAPIRoute";
import {
  GetDatasetV1Query,
  GetDatasetV1Response,
  transformDbDatasetItemDomainToAPIDatasetItem,
  transformDbDatasetToAPIDataset,
} from "@/src/features/public-api/types/datasets";
import {
  createDatasetItemFilterState,
  getDatasetItems,
} from "@hanzo/shared/src/server";
import { HanzoNotFoundError } from "@hanzo/shared";

export default withMiddlewares({
  GET: createAuthedProjectAPIRoute({
    name: "Get Dataset",
    querySchema: GetDatasetV1Query,
    responseSchema: GetDatasetV1Response,
    rateLimitResource: "datasets",
    fn: async ({ query, auth }) => {
      const { name } = query;

      const dataset = await prisma.dataset.findFirst({
        where: {
          name: name,
          projectId: auth.scope.projectId,
        },
        include: {
          datasetRuns: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!dataset) {
        throw new HanzoNotFoundError("Dataset not found");
      }

      const datasetItems = await getDatasetItems({
        projectId: auth.scope.projectId,
        filterState: createDatasetItemFilterState({
          datasetIds: [dataset.id],
          status: "ACTIVE",
        }),
        includeDatasetName: true,
      });

      const { datasetRuns, ...params } = dataset;

      return {
        ...transformDbDatasetToAPIDataset(params),
        items: datasetItems.map(transformDbDatasetItemDomainToAPIDatasetItem),
        runs: datasetRuns.map((run) => run.name),
      };
    },
  }),
});
