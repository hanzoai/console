import { api } from "@/src/utils/api";

// ── Models ─────────────────────────────────────────────────────────

export function useCloudModels(projectId: string) {
  return api.cloudModels.list.useQuery({ projectId }, { enabled: !!projectId });
}

// ── Model Config ───────────────────────────────────────────────────

export function useModelConfig(projectId: string) {
  return api.cloudModels.getConfig.useQuery({ projectId }, { enabled: !!projectId });
}

export function useUpdateModelConfig() {
  const utils = api.useUtils();
  return api.cloudModels.updateConfig.useMutation({
    onSuccess: (_data, variables) => {
      void utils.cloudModels.getConfig.invalidate({
        projectId: variables.projectId,
      });
    },
  });
}
