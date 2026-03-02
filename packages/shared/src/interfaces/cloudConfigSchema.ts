import { z } from "zod/v4";
import { CloudConfigRateLimit } from "./rate-limits";
import { cloudConfigPlans } from "../features/entitlements/plans";

export const CloudConfigSchema = z.object({
  plan: z.enum(cloudConfigPlans).optional(),
  monthlyObservationLimit: z.number().int().positive().optional(),
  // used for table and dashboard queries
  defaultLookBackDays: z.number().int().positive().optional(),
  // Billing configuration — managed by Hanzo Commerce service
  billing: z
    .object({
      customerId: z.string().nullish(),
      activeSubscriptionId: z.string().nullish(),
      activeProductId: z.string().nullish(),
      activeUsageProductId: z.string().nullish(),
      subscriptionStatus: z.string().nullish(),
    })
    .transform((data) => ({
      ...data,
      isLegacySubscription: data?.activeProductId != null && data?.activeUsageProductId == null,
    }))
    .nullish(),

  // Backwards compat: alias stripe → billing for orgs with old cloudConfig JSON
  stripe: z
    .object({
      customerId: z.string().nullish(),
      activeSubscriptionId: z.string().nullish(),
      activeProductId: z.string().nullish(),
      activeUsageProductId: z.string().nullish(),
      subscriptionStatus: z.string().nullish(),
    })
    .transform((data) => ({
      ...data,
      isLegacySubscription: data?.activeProductId != null && data?.activeUsageProductId == null,
    }))
    .nullish(),

  // custom rate limits for an organization
  rateLimitOverrides: CloudConfigRateLimit.optional(),

  // credit balance for pay-as-you-go usage
  credits: z.number().default(0).optional(),

  // trial expiry date
  trialExpiresAt: z.string().optional(),
});

export type CloudConfigSchema = z.infer<typeof CloudConfigSchema>;
