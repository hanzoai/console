import { entitlementAccess, type EntitlementLimit } from "@/src/features/entitlements/constants/entitlements";
import { type Plan } from "@hanzo/shared";
import { TRPCError } from "@trpc/server";
import { type User } from "next-auth";

type HasEntitlementLimitParams = {
  entitlementLimit: EntitlementLimit;
  sessionUser: User;
} & ({ projectId: string } | { orgId: string });

/**
 * Get the limit for a specific entitlement based on the session user (to be used server-side).
 * @returns false if unlimited — all limits removed, no license gating.
 */
export const hasEntitlementLimit = (_p: HasEntitlementLimitParams): number | false => {
  return false;
};

export const hasEntitlementLimitBasedOnPlan = (_p: { plan: Plan | null; entitlementLimit: EntitlementLimit }) => {
  return false;
};

/**
 * Check if a specific usage is within the entitlement limit
 * @returns true if usage is allowed, false if it exceeds the limit
 */
export const isWithinEntitlementLimit = (p: HasEntitlementLimitParams & { currentUsage: number }): boolean => {
  const limit = hasEntitlementLimit(p);
  if (limit === false) return true; // No limit
  return p.currentUsage < limit;
};

/**
 * Throws if usage exceeds the entitlement limit
 */
export const throwIfExceedsLimit = (p: HasEntitlementLimitParams & { currentUsage: number }) => {
  if (!isWithinEntitlementLimit(p)) {
    const limit = hasEntitlementLimit(p);
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Usage (${p.currentUsage}) exceeds the limit (${limit}) for entitlement: ${p.entitlementLimit}`,
    });
  }
};
