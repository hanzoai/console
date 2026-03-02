import { env } from "@/src/env.mjs";

export function isCloudBillingEnabled(): boolean {
  return !!env.NEXT_PUBLIC_HANZO_CLOUD_REGION;
}

export function useIsCloudBillingAvailable(): boolean {
  return !!env.NEXT_PUBLIC_HANZO_CLOUD_REGION;
}
