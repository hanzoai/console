import { env } from "@/src/env.mjs";

/**
 * Create a checkout client reference ID from an organization ID.
 * Used to link checkout sessions to organizations.
 * Format: {cloudRegion}_{orgId}
 */
export function createCheckoutReference(orgId: string): string | null {
  if (!orgId) {
    return null;
  }
  const cloudRegion = env.NEXT_PUBLIC_HANZO_CLOUD_REGION || "DEFAULT";
  return `${cloudRegion}_${orgId}`;
}

/**
 * Parse a checkout client reference ID to get the organization ID.
 */
export function parseCheckoutReference(clientReferenceId: string): string | null {
  if (!clientReferenceId) {
    return null;
  }
  // Format is {region}_{orgId}
  const parts = clientReferenceId.split("_");
  if (parts.length < 2) {
    return null;
  }
  // Return everything after the first underscore (in case orgId has underscores)
  return parts.slice(1).join("_");
}

/**
 * Extract org ID from a checkout client reference.
 */
export function getOrgIdFromCheckoutReference(clientReferenceId: string | null | undefined): string | undefined {
  if (!clientReferenceId) {
    return undefined;
  }
  return parseCheckoutReference(clientReferenceId) ?? undefined;
}

/**
 * Check if a client reference ID is from the current cloud region.
 */
export function isCheckoutReferenceFromCurrentCloudRegion(clientReferenceId: string | null | undefined): boolean {
  if (!clientReferenceId) {
    return false;
  }
  const currentRegion = env.NEXT_PUBLIC_HANZO_CLOUD_REGION || "DEFAULT";
  return clientReferenceId.startsWith(`${currentRegion}_`);
}

/** @deprecated Use createCheckoutReference instead */
export const createStripeClientReference = createCheckoutReference;
/** @deprecated Use parseCheckoutReference instead */
export const parseStripeClientReference = parseCheckoutReference;
/** @deprecated Use getOrgIdFromCheckoutReference instead */
export const getOrgIdFromStripeClientReference = getOrgIdFromCheckoutReference;
/** @deprecated Use isCheckoutReferenceFromCurrentCloudRegion instead */
export const isStripeClientReferenceFromCurrentCloudRegion = isCheckoutReferenceFromCurrentCloudRegion;
