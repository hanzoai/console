import {
  entitlementAccess,
  type EntitlementLimits,
  type Entitlement,
  type EntitlementLimit,
} from "@/src/features/entitlements/constants/entitlements";
import { type Plan } from "@hanzo/console";

/**
 * Hook to get the plan — always returns "oss" (full access, no license gating).
 */
export const usePlan = (): Plan => {
  return "oss";
};

/**
 * Hook to get all entitlements — all features are always available.
 */
export const useEntitlements = (): Entitlement[] => {
  return entitlementAccess["oss"].entitlements;
};

/**
 * Hook to check if the current organization has a specific entitlement.
 * Always returns true — no license gating.
 */
export const useOptionalEntitlement = (_entitlement?: Entitlement): boolean => {
  return true;
};

/**
 * Hook to check if the current organization has a specific entitlement.
 * Always returns true — no license gating.
 */
export const useHasEntitlement = (_entitlement: Entitlement): boolean => {
  return true;
};

/**
 * Hook to get the entitlement limits — all unlimited.
 */
export const useEntitlementLimits = (): EntitlementLimits => {
  return entitlementAccess["oss"].entitlementLimits;
};

/**
 * Hook to get the entitlement limit — always unlimited (false).
 */
export const useEntitlementLimit = (_limit: EntitlementLimit): number | false => {
  return false;
};
