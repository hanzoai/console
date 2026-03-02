import { api } from "@/src/utils/api";
import { type SearchMode } from "./types";

// ── Stats ───────────────────────────────────────────────────────────

export function useSearchStats(projectId: string) {
  return api.search.stats.useQuery({ projectId }, { enabled: !!projectId });
}

// ── Indexes ─────────────────────────────────────────────────────────

export function useSearchIndexes(projectId: string) {
  return api.search.listIndexes.useQuery({ projectId }, { enabled: !!projectId });
}

export function useCreateIndex() {
  const utils = api.useUtils();
  return api.search.createIndex.useMutation({
    onSuccess: () => {
      void utils.search.listIndexes.invalidate();
      void utils.search.stats.invalidate();
    },
  });
}

export function useDeleteIndex() {
  const utils = api.useUtils();
  return api.search.deleteIndex.useMutation({
    onSuccess: () => {
      void utils.search.listIndexes.invalidate();
      void utils.search.stats.invalidate();
    },
  });
}

export function useReindex() {
  const utils = api.useUtils();
  return api.search.reindex.useMutation({
    onSuccess: () => {
      void utils.search.listIndexes.invalidate();
    },
  });
}

// ── Search Query ────────────────────────────────────────────────────

export function useSearchQuery(params: {
  projectId: string;
  query: string;
  mode: SearchMode;
  limit?: number;
  enabled?: boolean;
}) {
  return api.search.query.useQuery(
    {
      projectId: params.projectId,
      query: params.query,
      mode: params.mode,
      limit: params.limit ?? 10,
    },
    { enabled: params.enabled ?? (!!params.projectId && !!params.query) },
  );
}

// ── Chat ────────────────────────────────────────────────────────────

export function useSearchChat() {
  return api.search.chat.useMutation();
}

// ── API Keys ────────────────────────────────────────────────────────

export function useSearchApiKeys(projectId: string) {
  return api.search.getKeys.useQuery({ projectId }, { enabled: !!projectId });
}

export function useRegenerateSearchKey() {
  const utils = api.useUtils();
  return api.search.regenerateKey.useMutation({
    onSuccess: () => {
      void utils.search.getKeys.invalidate();
    },
  });
}

// ── Scrape Preview ──────────────────────────────────────────────────

export function useScrapePreview() {
  return api.search.scrapePreview.useMutation();
}
