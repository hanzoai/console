import { z } from "zod/v4";
import { singleFilter, TracingSearchType } from "@hanzo/console-core";
import { orderBy } from "@hanzo/console-core";

export const GenerationTableOptions = z.object({
  projectId: z.string(), // Required for protectedProjectProcedure
  filter: z.array(singleFilter),
  searchQuery: z.string().nullable(),
  searchType: z.array(TracingSearchType),
  orderBy: orderBy,
});
