/**
 * Threshold processing - stub for community edition.
 * This feature is only available in the enterprise/cloud edition.
 */

import type { ParsedOrganization } from "@hanzo/shared";

/**
 * Data needed to update an organization's usage tracking fields
 */
export type OrgUpdateData = {
  orgId: string;
  cloudCurrentCycleUsage: number;
  cloudBillingCycleUpdatedAt: Date;
  cloudFreeTierUsageThresholdState: string | null;
  shouldInvalidateCache: boolean;
};

/**
 * Action taken during threshold processing
 */
export type ThresholdProcessingResult = {
  actionTaken: "BLOCKED" | "WARNING" | "PAID_PLAN" | "ENFORCEMENT_DISABLED" | "NONE";
  emailSent: boolean;
  emailFailed: boolean;
  updateData: OrgUpdateData;
};

/**
 * Process threshold crossings for an organization - stub implementation
 */
export async function processThresholds(
  org: ParsedOrganization,
  cumulativeUsage: number,
): Promise<ThresholdProcessingResult> {
  return {
    actionTaken: "NONE",
    emailSent: false,
    emailFailed: false,
    updateData: {
      orgId: org.id,
      cloudCurrentCycleUsage: cumulativeUsage,
      cloudBillingCycleUpdatedAt: new Date(),
      cloudFreeTierUsageThresholdState: null,
      shouldInvalidateCache: false,
    },
  };
}
