import {
  entitlementAccess,
  type Entitlement,
} from "@/src/features/entitlements/constants/entitlements";
import { TRPCError } from "@trpc/server";
import { type User } from "next-auth";
import { type Plan } from "@hanzo/shared";

type HasEntitlementParams = {
  entitlement: Entitlement;
  sessionUser: User;
} & ({ projectId: string } | { orgId: string });

/**
 * Check if user has access to a specific entitlement based on the session user (to be used server-side).
 */
export const hasEntitlement = (p: HasEntitlementParams): Boolean => {
  try {
    // If user is admin, they have all entitlements
    if (p.sessionUser.admin) return true;

    // Find the relevant organization
    const org =
      "projectId" in p
        ? p.sessionUser.organizations?.find((org) =>
            org.projects?.some((proj) => proj.id === p.projectId),
          )
        : p.sessionUser.organizations?.find((org) => org.id === p.orgId);

    // If no organization found, return false
    if (!org) return false;

    // Use getOrganizationPlanServerSide to get the plan
    const rawPlan = org.plan;

    // Convert the plan using similar logic as getOrganizationPlanServerSide
    let plan: Plan;
    if (rawPlan?.toUpperCase() === "PRO") {
      plan = "cloud:pro";
    } else if (rawPlan?.toUpperCase() === "TEAM") {
      plan = "cloud:team";
    } else if (rawPlan?.toUpperCase() === "ENTERPRISE") {
      plan = "cloud:enterprise";
    } else if (rawPlan?.toUpperCase() === "CORE") {
      plan = "cloud:core";
    } else if (rawPlan?.toUpperCase() === "HOBBY") {
      plan = "cloud:hobby";
    } else {
      plan = "cloud:free";
    }

    return hasEntitlementBasedOnPlan({ plan, entitlement: p.entitlement });
  } catch (error) {
    console.error("Error in hasEntitlement:", error);
    return false;
  }
};

/**
 * Check if user has access to a specific entitlement based on the plan.
 */
export const hasEntitlementBasedOnPlan = ({
  plan,
  entitlement,
}: {
  plan: Plan | null;
  entitlement: Entitlement;
}) => {
  try {
    // If no plan, return false
    if (!plan) return false;

    // Check if the plan exists in entitlementAccess
    if (!(plan in entitlementAccess)) {
      console.warn(`Plan ${plan} not found in entitlementAccess`);
      return false;
    }

    // Check if entitlements exist for the plan
    if (!entitlementAccess[plan]?.entitlements) {
      console.warn(`No entitlements found for plan ${plan}`);
      return false;
    }

    return entitlementAccess[plan].entitlements.includes(entitlement);
  } catch (error) {
    console.error("Error in hasEntitlementBasedOnPlan:", error);
    return false;
  }
};

export const throwIfNoEntitlement = (p: HasEntitlementParams) => {
  if (!hasEntitlement(p)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Unauthorized, user does not have access to entitlement: " +
        p.entitlement,
    });
  }
};
