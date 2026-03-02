import { api } from "@/src/utils/api";

// ── Stats ───────────────────────────────────────────────────────────

export function useVectorStats(projectId: string) {
  return api.vector.stats.useQuery({ projectId }, { enabled: !!projectId });
}

// ── Collections ─────────────────────────────────────────────────────

export function useVectorCollections(projectId: string) {
  return api.vector.listCollections.useQuery({ projectId }, { enabled: !!projectId });
}

export function useCreateCollection() {
  const utils = api.useUtils();
  return api.vector.createCollection.useMutation({
    onSuccess: () => {
      void utils.vector.listCollections.invalidate();
      void utils.vector.stats.invalidate();
    },
  });
}

export function useDeleteCollection() {
  const utils = api.useUtils();
  return api.vector.deleteCollection.useMutation({
    onSuccess: () => {
      void utils.vector.listCollections.invalidate();
      void utils.vector.stats.invalidate();
    },
  });
}
