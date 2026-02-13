import { z } from "zod";

/**
 * Schema and type definitions for subscription metadata.
 * This metadata is crucial for multi-region deployment and organization tracking.
 *
 * Usage flow:
 * 1. Set during subscription creation in billingService.ts:
 *    - Added to subscription_data.metadata in createCheckoutSession
 *    - Contains orgId and cloudRegion for new subscriptions
 *
 * 2. Validated in webhook handlers:
 *    - Used to ensure webhooks are processed in correct cloud region
 *    - Automatically added to subscriptions if missing
 *    - Prevents duplicate subscription processing across regions
 *
 * @property orgId - Links the subscription to a specific organization
 * @property cloudRegion - Identifies which cloud region (e.g., EU, US) handles this subscription
 */
export const SubscriptionMetadataSchema = z.object({
  orgId: z.string().optional(),
  cloudRegion: z.string().optional(),
});

export type SubscriptionMetadata = z.infer<typeof SubscriptionMetadataSchema>;

/** @deprecated Use SubscriptionMetadataSchema instead */
export const StripeSubscriptionMetadataSchema = SubscriptionMetadataSchema;
/** @deprecated Use SubscriptionMetadata instead */
export type StripeSubscriptionMetadata = SubscriptionMetadata;
