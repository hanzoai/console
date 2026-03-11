import { entitlementAccess, type Entitlement } from "@/src/features/entitlements/constants/entitlements";
import { TRPCError } from "@trpc/server";
import { type User } from "next-auth";
import { type Plan } from "@hanzo/console";

type HasEntitlementParams = {
  entitlement: Entitlement;
  sessionUser: User;
} & ({ projectId: string } | { orgId: string });

/**
 * Check if user has access to a specific entitlement based on the session user (to be used server-side).
 * All entitlements are always available — no license gating.
 */
export const hasEntitlement = (_p: HasEntitlementParams): Boolean => {
  return true;
};

/**
 * Check if user has access to a specific entitlement based on the plan.
 * All entitlements are always available — no license gating.
 */
export const hasEntitlementBasedOnPlan = (_p: { plan: Plan | null; entitlement: Entitlement }) => {
  return true;
};

export const throwIfNoEntitlement = (p: HasEntitlementParams) => {
  if (!hasEntitlement(p)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Unauthorized, user does not have access to entitlement: " + p.entitlement,
    });
  }
};
