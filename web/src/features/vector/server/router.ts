import { z } from "zod/v4";
import { createTRPCRouter, protectedProjectProcedure } from "@/src/server/api/trpc";
import { vectorGet, vectorPost, vectorDelete, resolveApiKey } from "./vectorClient";
import {
  CreateCollectionInput,
  DeleteCollectionInput,
  VectorSearchInput,
  type VectorCollection,
  type VectorResult,
  type VectorStats,
} from "../types";

export const vectorRouter = createTRPCRouter({
  // ── Stats ─────────────────────────────────────────────────────────

  stats: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async ({ input }) => {
    const apiKey = resolveApiKey();
    try {
      return await vectorGet<VectorStats>("/api/vector/stats", apiKey, { projectId: input.projectId });
    } catch {
      return {
        totalCollections: 0,
        totalVectors: 0,
        totalStorageBytes: 0,
      } satisfies VectorStats;
    }
  }),

  // ── Collections ───────────────────────────────────────────────────

  listCollections: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async ({ input }) => {
    const apiKey = resolveApiKey();
    try {
      return await vectorGet<{ collections: VectorCollection[] }>("/api/vector/collections", apiKey, {
        projectId: input.projectId,
      });
    } catch {
      return { collections: [] as VectorCollection[] };
    }
  }),

  createCollection: protectedProjectProcedure.input(CreateCollectionInput).mutation(async ({ input }) => {
    const apiKey = resolveApiKey();
    return vectorPost<{ collection: VectorCollection }>("/api/vector/collections", apiKey, {
      name: input.name,
      dimension: input.dimension,
      distanceMetric: input.distanceMetric,
      projectId: input.projectId,
    });
  }),

  deleteCollection: protectedProjectProcedure.input(DeleteCollectionInput).mutation(async ({ input }) => {
    const apiKey = resolveApiKey();
    return vectorDelete<{ success: boolean }>(`/api/vector/collections/${encodeURIComponent(input.name)}`, apiKey, {
      projectId: input.projectId,
    });
  }),

  // ── Vector Search ─────────────────────────────────────────────────

  search: protectedProjectProcedure.input(VectorSearchInput).query(async ({ input }) => {
    const apiKey = resolveApiKey();
    return vectorPost<{ results: VectorResult[] }>(
      `/api/vector/collections/${encodeURIComponent(input.collectionName)}/search`,
      apiKey,
      {
        queryVector: input.queryVector,
        limit: input.limit,
        projectId: input.projectId,
      },
    );
  }),
});
