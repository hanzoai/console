import { z } from "zod/v4";

// ── Search Index (Store) ────────────────────────────────────────────

export const SearchIndexSchema = z.object({
  name: z.string(),
  docCount: z.number(),
  lastIndexedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type SearchIndex = z.infer<typeof SearchIndexSchema>;

export const CreateIndexInput = z.object({
  projectId: z.string(),
  storeName: z.string().min(1),
  url: z.string().url(),
});
export type CreateIndexInput = z.infer<typeof CreateIndexInput>;

export const DeleteIndexInput = z.object({
  projectId: z.string(),
  storeName: z.string().min(1),
});
export type DeleteIndexInput = z.infer<typeof DeleteIndexInput>;

export const ReindexInput = z.object({
  projectId: z.string(),
  storeName: z.string().min(1),
});
export type ReindexInput = z.infer<typeof ReindexInput>;

// ── Search Query ────────────────────────────────────────────────────

export const SearchMode = z.enum(["hybrid", "fulltext", "vector"]);
export type SearchMode = z.infer<typeof SearchMode>;

export const SearchQueryInput = z.object({
  projectId: z.string(),
  query: z.string().min(1),
  mode: SearchMode.default("hybrid"),
  limit: z.number().min(1).max(100).default(10),
});
export type SearchQueryInput = z.infer<typeof SearchQueryInput>;

export const SearchResultSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  content: z.string(),
  score: z.number(),
  highlights: z.array(z.string()).optional(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

// ── Chat (RAG) ──────────────────────────────────────────────────────

export const ChatQueryInput = z.object({
  projectId: z.string(),
  query: z.string().min(1),
});
export type ChatQueryInput = z.infer<typeof ChatQueryInput>;

// ── Stats ───────────────────────────────────────────────────────────

export const SearchStatsSchema = z.object({
  totalDocuments: z.number(),
  totalSearches: z.number(),
  totalSessions: z.number(),
  searchesPerDay: z.array(
    z.object({
      date: z.string(),
      count: z.number(),
    }),
  ),
});
export type SearchStats = z.infer<typeof SearchStatsSchema>;

// ── API Keys ────────────────────────────────────────────────────────

export const SearchApiKeySchema = z.object({
  publishableKey: z.string(),
  adminKey: z.string(),
});
export type SearchApiKey = z.infer<typeof SearchApiKeySchema>;

export const RegenerateKeyInput = z.object({
  projectId: z.string(),
  keyType: z.enum(["publishable", "admin"]),
});
export type RegenerateKeyInput = z.infer<typeof RegenerateKeyInput>;

// ── Scrape ──────────────────────────────────────────────────────────

export const ScrapeInput = z.object({
  projectId: z.string(),
  storeName: z.string().min(1),
  url: z.string().url(),
});
export type ScrapeInput = z.infer<typeof ScrapeInput>;

export const ScrapePreviewInput = z.object({
  projectId: z.string(),
  url: z.string().url(),
});
export type ScrapePreviewInput = z.infer<typeof ScrapePreviewInput>;
