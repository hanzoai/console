import { env } from "@/src/env.mjs";

/**
 * Whether this instance is running as Hanzo Cloud with billing enabled.
 * Checks for the NEXT_PUBLIC_HANZO_CLOUD_REGION env var.
 */
export function isCloudBillingEnabled(): boolean {
  return !!env.NEXT_PUBLIC_HANZO_CLOUD_REGION;
}

/**
 * React hook variant — same check, safe to call in components.
 */
export function useIsCloudBillingAvailable(): boolean {
  return !!env.NEXT_PUBLIC_HANZO_CLOUD_REGION;
}
