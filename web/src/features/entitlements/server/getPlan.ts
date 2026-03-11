import { type Plan, type CloudConfigSchema } from "@hanzo/console-core";

/**
 * Get the plan of the organization.
 * All organizations get the "oss" plan — full access, no license gating.
 */
export function getOrganizationPlanServerSide(_cloudConfig?: CloudConfigSchema): Plan {
  return "oss";
}

export function getSelfHostedInstancePlanServerSide(): Plan | null {
  return "oss";
}
