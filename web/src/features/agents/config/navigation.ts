import type { NavigationSection } from "@/src/features/agents/components/Navigation/types";

/**
 * PRIMARY section — space-scoped, always visible (6 items)
 */
export const primarySections: NavigationSection[] = [
  {
    id: "primary",
    title: "",
    items: [
      {
        id: "overview",
        label: "Overview",
        href: "/dashboard",
        icon: "dashboard",
        description: "Dashboard metrics scoped to active space",
      },
      {
        id: "bots",
        label: "Bots",
        href: "/bots/all",
        icon: "bot",
        description: "All bots in this space",
      },
      {
        id: "playground",
        label: "Playground",
        href: "/playground",
        icon: "function",
        description: "Canvas for visual orchestration",
      },
      {
        id: "executions",
        label: "Executions",
        href: "/executions",
        icon: "run",
        description: "Unified execution and workflow list",
      },
      {
        id: "logs",
        label: "Logs",
        href: "/logs",
        icon: "activity",
        description: "Unified log viewer",
      },
      {
        id: "settings",
        label: "Settings",
        href: "/settings",
        icon: "settings",
        description: "Gateway, Space, and Webhook settings",
      },
    ],
  },
];

/**
 * MORE section — org-level, collapsible, collapsed by default (4 items)
 */
export const moreSections: NavigationSection[] = [
  {
    id: "more",
    title: "More",
    items: [
      {
        id: "spaces",
        label: "Spaces",
        href: "/spaces",
        icon: "data-center",
        description: "List and manage all spaces",
      },
      {
        id: "teams",
        label: "Teams",
        href: "/teams",
        icon: "users",
        description: "Team provisioning",
      },
      {
        id: "identity",
        label: "Identity",
        href: "/identity/dids",
        icon: "shield-check",
        description: "DID Explorer and Credentials",
      },
      {
        id: "packages",
        label: "Packages",
        href: "/packages",
        icon: "package",
        description: "Bot templates",
      },
    ],
  },
];

/**
 * @deprecated Use primarySections + moreSections instead.
 * Kept for backward compatibility during migration.
 */
export const navigationSections: NavigationSection[] = [...primarySections, ...moreSections];
