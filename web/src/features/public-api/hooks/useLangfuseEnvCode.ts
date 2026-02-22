import { useUiCustomization } from "@/src/ee/features/ui-customization/useUiCustomization";
import { env } from "@/src/env.mjs";

export function useLangfuseEnvCode(keys?: {
  secretKey: string;
  publicKey: string;
}): string {
  const uiCustomization = useUiCustomization();
  const baseUrl = `${uiCustomization?.hostname ?? window.origin}${env.NEXT_PUBLIC_BASE_PATH ?? ""}`;

  if (keys) {
    return `HANZO_SECRET_KEY="${keys.secretKey}"
HANZO_PUBLIC_KEY="${keys.publicKey}"
HANZO_BASE_URL="${baseUrl}"`;
  }

  return `HANZO_SECRET_KEY="sk-lf-..."
HANZO_PUBLIC_KEY="pk-lf-..."
HANZO_BASE_URL="${baseUrl}"`;
}
