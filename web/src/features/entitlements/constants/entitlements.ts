import { type Plan } from "@hanzo/console";

// Entitlements: Binary feature access
// Exported to silence @typescript-eslint/no-unused-vars v8 warning
// (used for type extraction via typeof, which is a legitimate pattern)
export const entitlements = [
  // features
  "rbac-project-roles",
  "cloud-billing",
  "cloud-spend-alerts",
  "cloud-multi-tenant-sso",
  "self-host-ui-customization",
  "self-host-allowed-organization-creators",
  "trace-deletion", // Not in use anymore, but necessary to use the TableAction type.
  "audit-logs",
  "data-retention",
  "scheduled-blob-exports",
  "prompt-protected-labels",
  "admin-api",
  "annotation-queues",
  "model-based-evaluations",
  "playground",
  "prompt-experiments",
  "integration-insights",
] as const;
export type Entitlement = (typeof entitlements)[number];

const cloudAllPlansEntitlements: Entitlement[] = ["cloud-billing", "trace-deletion"];

// All features available for self-hosted and OSS deployments (permissive open source)
const allEntitlements: Entitlement[] = [
  "rbac-project-roles",
  "trace-deletion",
  "audit-logs",
  "data-retention",
  "scheduled-blob-exports",
  "prompt-protected-labels",
  "admin-api",
  "annotation-queues",
  "model-based-evaluations",
  "playground",
  "prompt-experiments",
  "integration-insights",
  "self-host-ui-customization",
  "self-host-allowed-organization-creators",
];

const unlimitedLimits = {
  "annotation-queue-count": false as const,
  "organization-member-count": false as const,
  "data-access-days": false as const,
  "model-based-evaluations-count-evaluators": false as const,
  "prompt-management-count-prompts": false as const,
};

// Entitlement Limits: Limits on the number of resources that can be created/used
// Exported to silence @typescript-eslint/no-unused-vars v8 warning
// (used for type extraction via typeof, which is a legitimate pattern)
export const entitlementLimits = [
  "annotation-queue-count",
  "organization-member-count",
  "data-access-days",
  "model-based-evaluations-count-evaluators",
  "prompt-management-count-prompts",
] as const;
export type EntitlementLimit = (typeof entitlementLimits)[number];

export type EntitlementLimits = Record<
  EntitlementLimit,
  | number // if limited
  | false // unlimited
>;

export const entitlementAccess: Record<
  Plan,
  {
    entitlements: Entitlement[];
    entitlementLimits: EntitlementLimits;
  }
> = {
  "cloud:free": {
    entitlements: [...cloudAllPlansEntitlements],
    entitlementLimits: {
      "organization-member-count": 2,
      "data-access-days": 30,
      "annotation-queue-count": 1,
      "model-based-evaluations-count-evaluators": false,
      "prompt-management-count-prompts": false,
    },
  },
  "cloud:hobby": {
    entitlements: [...cloudAllPlansEntitlements],
    entitlementLimits: {
      "organization-member-count": 3,
      "data-access-days": 60,
      "annotation-queue-count": 2,
      "model-based-evaluations-count-evaluators": false,
      "prompt-management-count-prompts": false,
    },
  },
  "cloud:core": {
    entitlements: [...cloudAllPlansEntitlements, "cloud-spend-alerts"],
    entitlementLimits: {
      "organization-member-count": false,
      "data-access-days": 90,
      "annotation-queue-count": 3,
      "model-based-evaluations-count-evaluators": false,
      "prompt-management-count-prompts": false,
    },
  },
  "cloud:pro": {
    entitlements: [...cloudAllPlansEntitlements, "cloud-spend-alerts", "data-retention"],
    entitlementLimits: {
      "annotation-queue-count": false,
      "organization-member-count": false,
      "data-access-days": false,
      "model-based-evaluations-count-evaluators": false,
      "prompt-management-count-prompts": false,
    },
  },
  "cloud:team": {
    entitlements: [
      ...cloudAllPlansEntitlements,
      "rbac-project-roles",
      "audit-logs",
      "data-retention",
      "cloud-multi-tenant-sso",
      "prompt-protected-labels",
      "admin-api",
      "scheduled-blob-exports",
      "cloud-spend-alerts",
    ],
    entitlementLimits: unlimitedLimits,
  },
  "cloud:enterprise": {
    entitlements: [
      ...cloudAllPlansEntitlements,
      "rbac-project-roles",
      "audit-logs",
      "data-retention",
      "cloud-multi-tenant-sso",
      "prompt-protected-labels",
      "admin-api",
      "scheduled-blob-exports",
      "cloud-spend-alerts",
    ],
    entitlementLimits: unlimitedLimits,
  },
  // Open source and self-hosted: full access to all features, no limits
  oss: {
    entitlements: allEntitlements,
    entitlementLimits: unlimitedLimits,
  },
  "self-hosted:pro": {
    entitlements: allEntitlements,
    entitlementLimits: unlimitedLimits,
  },
  "self-hosted:team": {
    entitlements: allEntitlements,
    entitlementLimits: unlimitedLimits,
  },
  "self-hosted:dev": {
    entitlements: allEntitlements,
    entitlementLimits: unlimitedLimits,
  },
};
