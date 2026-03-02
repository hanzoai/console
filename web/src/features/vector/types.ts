import { z } from "zod/v4";

// ── Collection ──────────────────────────────────────────────────────

export const VectorCollectionSchema = z.object({
  name: z.string(),
  vectorCount: z.number(),
  dimension: z.number(),
  distanceMetric: z.string(),
  storageBytes: z.number().optional(),
  createdAt: z.string(),
});
export type VectorCollection = z.infer<typeof VectorCollectionSchema>;

export const CreateCollectionInput = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  dimension: z.number().min(1).max(4096).default(1536),
  distanceMetric: z.enum(["cosine", "euclidean", "dotProduct"]).default("cosine"),
});
export type CreateCollectionInput = z.infer<typeof CreateCollectionInput>;

export const DeleteCollectionInput = z.object({
  projectId: z.string(),
  name: z.string().min(1),
});
export type DeleteCollectionInput = z.infer<typeof DeleteCollectionInput>;

// ── Vector Search ───────────────────────────────────────────────────

export const VectorSearchInput = z.object({
  projectId: z.string(),
  collectionName: z.string().min(1),
  queryVector: z.array(z.number()),
  limit: z.number().min(1).max(100).default(10),
});
export type VectorSearchInput = z.infer<typeof VectorSearchInput>;

export const VectorResultSchema = z.object({
  id: z.string(),
  score: z.number(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type VectorResult = z.infer<typeof VectorResultSchema>;

// ── Stats ───────────────────────────────────────────────────────────

export const VectorStatsSchema = z.object({
  totalCollections: z.number(),
  totalVectors: z.number(),
  totalStorageBytes: z.number(),
});
export type VectorStats = z.infer<typeof VectorStatsSchema>;
