import { mapStripeProductIdToPlan } from "@/src/features/billing/utils/stripeProducts";
import { env } from "@/src/env.mjs";
import { type Plan } from "@hanzo/shared";
import { type CloudConfigSchema } from "@hanzo/shared";

/**
 * Get the plan of the organization based on the cloud configuration. Used to add this plan to the organization object in JWT via NextAuth.
 */
export function getOrganizationPlanServerSide(
  cloudConfig?: CloudConfigSchema,
): Plan {
  if (process.env.NEXT_PUBLIC_HANZO_CLOUD_REGION) {
    // in dev, grant team plan to all organizations
    // if (process.env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV") {
    //   return "cloud:team";
    // }
    if (cloudConfig) {
      // manual plan override
      if (cloudConfig.plan) {
        switch (cloudConfig.plan) {
          case "Pro":
            return "cloud:pro";
          case "Team":
          case "Dev":
            return "cloud:dev";
          default:
            return "cloud:free";
        }
      }
      // stripe plan via product id
      if (cloudConfig.stripe?.activeProductId) {
        const stripePlan = mapStripeProductIdToPlan(
          cloudConfig.stripe.activeProductId,
        );
        if (stripePlan) {
          return stripePlan.toString() as Plan;
        }
      }
    }
    return "cloud:free";
  }

  const selfHostedPlan = getSelfHostedInstancePlanServerSide();
  if (selfHostedPlan) {
    return selfHostedPlan;
  }

  return "cloud:free";
}

export function getSelfHostedInstancePlanServerSide(): Plan | null {
  const licenseKey = env.HANZO_EE_LICENSE_KEY;
  if (!licenseKey) return null;
  if (licenseKey.startsWith("hanzo_ee_")) {
    return "self-hosted:pro";
  }
  if (licenseKey.startsWith("hanzo_pro_")) {
    return "self-hosted:pro";
  }
  return null;
}
