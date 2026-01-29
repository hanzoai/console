/**
 * Usage aggregation - stub for community edition.
 * This feature is only available in the enterprise/cloud edition.
 */

import type { ParsedOrganization } from "@hanzo/shared";

/**
 * Map of projectId to orgId
 */
interface ProjectToOrgMap {
  [projectId: string]: string;
}

/**
 * Usage counts aggregated at org level
 */
interface UsageByOrg {
  [orgId: string]: {
    traces: number;
    observations: number;
    scores: number;
    total: number;
  };
}

/**
 * Statistics returned from usage aggregation processing
 */
export type UsageAggregationStats = {
  totalOrgsProcessed: number;
  totalOrgsUpdatedSuccessfully: number;
  totalOrgsFailed: number;
  failedOrgIds: string[];
};

/**
 * Build a map of projectId → orgId - stub implementation
 */
async function buildProjectToOrgMap(): Promise<ProjectToOrgMap> {
  return {};
}

/**
 * Fetch all organizations with billing info - stub implementation
 */
async function fetchAllOrgsWithBillingInfo(): Promise<ParsedOrganization[]> {
  return [];
}

/**
 * Aggregate project-level counts to org-level - stub implementation
 */
function aggregateByOrg(
  _traceCounts: Array<{ count: number; projectId: string; date: string }>,
  _obsCounts: Array<{ count: number; projectId: string; date: string }>,
  _scoreCounts: Array<{ count: number; projectId: string; date: string }>,
  _projectToOrgMap: ProjectToOrgMap,
): UsageByOrg {
  return {};
}

/**
 * Process usage aggregation for all organizations - stub implementation
 */
export async function processUsageAggregationForAllOrgs(
  _referenceDate: Date = new Date(),
  _onProgress?: (progress: number) => void | Promise<void>,
): Promise<UsageAggregationStats> {
  return {
    totalOrgsProcessed: 0,
    totalOrgsUpdatedSuccessfully: 0,
    totalOrgsFailed: 0,
    failedOrgIds: [],
  };
}

// Export helper functions for testing
export { buildProjectToOrgMap, fetchAllOrgsWithBillingInfo, aggregateByOrg };
