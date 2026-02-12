import { api } from "@/src/utils/api";

// ── Secrets ──────────────────────────────────────────────────────────

export function useKmsSecrets(
  projectId: string,
  environment: string,
  secretPath = "/",
) {
  return api.kms.listSecrets.useQuery(
    { projectId, environment, secretPath },
    { enabled: !!projectId && !!environment },
  );
}

export function useCreateSecret() {
  const utils = api.useUtils();
  return api.kms.createSecret.useMutation({
    onSuccess: () => {
      void utils.kms.listSecrets.invalidate();
    },
  });
}

export function useUpdateSecret() {
  const utils = api.useUtils();
  return api.kms.updateSecret.useMutation({
    onSuccess: () => {
      void utils.kms.listSecrets.invalidate();
    },
  });
}

export function useDeleteSecret() {
  const utils = api.useUtils();
  return api.kms.deleteSecret.useMutation({
    onSuccess: () => {
      void utils.kms.listSecrets.invalidate();
    },
  });
}

// ── Environments ─────────────────────────────────────────────────────

export function useKmsEnvironments(projectId: string) {
  return api.kms.listEnvironments.useQuery(
    { projectId },
    { enabled: !!projectId },
  );
}

// ── Encryption Keys ─────────────────────────────────────────────────

export function useKmsKeys(projectId: string) {
  return api.kms.listKeys.useQuery(
    { projectId },
    { enabled: !!projectId },
  );
}

export function useCreateKey() {
  const utils = api.useUtils();
  return api.kms.createKey.useMutation({
    onSuccess: () => {
      void utils.kms.listKeys.invalidate();
    },
  });
}

export function useUpdateKey() {
  const utils = api.useUtils();
  return api.kms.updateKey.useMutation({
    onSuccess: () => {
      void utils.kms.listKeys.invalidate();
    },
  });
}

export function useDeleteKey() {
  const utils = api.useUtils();
  return api.kms.deleteKey.useMutation({
    onSuccess: () => {
      void utils.kms.listKeys.invalidate();
    },
  });
}
