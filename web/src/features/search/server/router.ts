import { z } from "zod/v4";
import { createTRPCRouter, protectedProjectProcedure } from "@/src/server/api/trpc";
import { searchGet, searchPost, searchDelete, resolveApiKey } from "./searchClient";
import {
  CreateIndexInput,
  DeleteIndexInput,
  ReindexInput,
  SearchQueryInput,
  ChatQueryInput,
  ScrapePreviewInput,
  RegenerateKeyInput,
  type SearchStats,
  type SearchIndex,
  type SearchResult,
  type SearchApiKey,
} from "../types";

export const searchRouter = createTRPCRouter({
  // ── Stats ─────────────────────────────────────────────────────────

  stats: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async ({ input }) => {
    const apiKey = resolveApiKey(undefined);
    try {
      return await searchGet<SearchStats>("/api/search-docs/stats", apiKey, { projectId: input.projectId });
    } catch {
      return {
        totalDocuments: 0,
        totalSearches: 0,
        totalSessions: 0,
        searchesPerDay: [],
      } satisfies SearchStats;
    }
  }),

  // ── Indexes ───────────────────────────────────────────────────────

  listIndexes: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async ({ input }) => {
    const apiKey = resolveApiKey(undefined);
    try {
      return await searchGet<{ indexes: SearchIndex[] }>("/api/search-docs/indexes", apiKey, {
        projectId: input.projectId,
      });
    } catch {
      return { indexes: [] as SearchIndex[] };
    }
  }),

  createIndex: protectedProjectProcedure.input(CreateIndexInput).mutation(async ({ input }) => {
    const apiKey = resolveApiKey(undefined);
    return searchPost<{ index: SearchIndex }>("/api/scrape-docs", apiKey, {
      storeName: input.storeName,
      url: input.url,
      projectId: input.projectId,
    });
  }),

  deleteIndex: protectedProjectProcedure.input(DeleteIndexInput).mutation(async ({ input }) => {
    const apiKey = resolveApiKey(undefined);
    return searchDelete<{ success: boolean }>(
      `/api/search-docs/indexes/${encodeURIComponent(input.storeName)}`,
      apiKey,
      { projectId: input.projectId },
    );
  }),

  reindex: protectedProjectProcedure.input(ReindexInput).mutation(async ({ input }) => {
    const apiKey = resolveApiKey(undefined);
    return searchPost<{ success: boolean }>(
      `/api/search-docs/indexes/${encodeURIComponent(input.storeName)}/reindex`,
      apiKey,
      { projectId: input.projectId },
    );
  }),

  // ── Search ────────────────────────────────────────────────────────

  query: protectedProjectProcedure.input(SearchQueryInput).query(async ({ input }) => {
    const apiKey = resolveApiKey(undefined);
    return searchPost<{ results: SearchResult[] }>("/api/search-docs", apiKey, {
      query: input.query,
      mode: input.mode,
      limit: input.limit,
      projectId: input.projectId,
    });
  }),

  // ── Chat (RAG) ────────────────────────────────────────────────────

  chat: protectedProjectProcedure.input(ChatQueryInput).mutation(async ({ input }) => {
    const apiKey = resolveApiKey(undefined);
    return searchPost<{ response: string; sources: Array<{ url: string; title: string }> }>("/api/chat-docs", apiKey, {
      query: input.query,
      projectId: input.projectId,
    });
  }),

  // ── API Keys ──────────────────────────────────────────────────────

  getKeys: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async ({ input }) => {
    const apiKey = resolveApiKey(undefined);
    try {
      return await searchGet<SearchApiKey>("/api/search-docs/keys", apiKey, { projectId: input.projectId });
    } catch {
      return {
        publishableKey: "",
        adminKey: "",
      } satisfies SearchApiKey;
    }
  }),

  regenerateKey: protectedProjectProcedure.input(RegenerateKeyInput).mutation(async ({ input }) => {
    const apiKey = resolveApiKey(undefined);
    return searchPost<SearchApiKey>("/api/search-docs/keys/regenerate", apiKey, {
      keyType: input.keyType,
      projectId: input.projectId,
    });
  }),

  // ── Scrape Preview ────────────────────────────────────────────────

  scrapePreview: protectedProjectProcedure.input(ScrapePreviewInput).mutation(async ({ input }) => {
    const apiKey = resolveApiKey(undefined);
    return searchPost<{ pages: Array<{ url: string; title: string }> }>("/api/scrape-docs/preview", apiKey, {
      url: input.url,
      projectId: input.projectId,
    });
  }),
});
