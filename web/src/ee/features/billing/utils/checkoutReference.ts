import { env } from "@/src/env.mjs";
import { logger } from "@hanzo/shared/src/server";
import { TRPCError } from "@trpc/server";

/**
 * Utilities for managing checkout client references in a multi-region deployment.
 * Client references are used to link subscriptions to organizations and ensure
 * webhooks are processed in the correct cloud region.
 *
 * Flow:
 * 1. createCheckoutReference: Creates reference during checkout (billingService.ts)
 * 2. isCheckoutReferenceFromCurrentCloudRegion: Validates region in webhooks
 * 3. getOrgIdFromCheckoutReference: Extracts org ID for processing
 *
 * Format: `${cloudRegion}-${orgId}`
 * Example: "EU-org_123" or "US-org_456"
 */

/**
 * Creates a checkout client reference by combining cloud region and organization ID.
 * Used when creating new checkout sessions in billingService.ts.
 *
 * @throws {TRPCError} If not running in a Hanzo Cloud environment
 */
export const createCheckoutReference = (orgId: string) => {
  if (!env.NEXT_PUBLIC_HANZO_CLOUD_REGION) {
    logger.error("Returning null checkout reference, you cannot run the checkout page outside of Hanzo Cloud");
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Cannot create checkout reference outside of Hanzo Cloud",
    });
  }
  return `${env.NEXT_PUBLIC_HANZO_CLOUD_REGION}-${orgId}`;
};

/**
 * Validates if a client reference belongs to the current cloud region.
 * Used in webhook handlers to ensure webhooks are processed in the correct region.
 *
 * @param clientReference - The client reference (format: "REGION-orgId")
 * @returns true if the reference matches the current cloud region
 */
export const isCheckoutReferenceFromCurrentCloudRegion = (clientReference: string) =>
  env.NEXT_PUBLIC_HANZO_CLOUD_REGION && clientReference.startsWith(env.NEXT_PUBLIC_HANZO_CLOUD_REGION);

/**
 * Extracts the organization ID from a client reference.
 * Used in webhook handlers after validating the cloud region.
 *
 * @param clientReference - The client reference (format: "REGION-orgId")
 * @returns The extracted organization ID
 */
export const getOrgIdFromCheckoutReference = (clientReference: string) =>
  clientReference.replace(`${env.NEXT_PUBLIC_HANZO_CLOUD_REGION}-`, "");

/** @deprecated Use createCheckoutReference instead */
export const createStripeClientReference = createCheckoutReference;
/** @deprecated Use isCheckoutReferenceFromCurrentCloudRegion instead */
export const isStripeClientReferenceFromCurrentCloudRegion = isCheckoutReferenceFromCurrentCloudRegion;
/** @deprecated Use getOrgIdFromCheckoutReference instead */
export const getOrgIdFromStripeClientReference = getOrgIdFromCheckoutReference;
