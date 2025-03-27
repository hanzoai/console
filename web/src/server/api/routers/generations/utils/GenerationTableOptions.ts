import { z } from "zod";
import { singleFilter } from "@hanzo/shared";
import { orderBy } from "@hanzo/shared";

export const GenerationTableOptions = z.object({
  projectId: z.string(), // Required for protectedProjectProcedure
  filter: z.array(singleFilter),
  searchQuery: z.string().nullable(),
  orderBy: orderBy,
});
