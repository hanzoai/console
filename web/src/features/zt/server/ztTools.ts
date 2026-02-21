import { ztGet, ztPost, ztPatch, ztDelete } from "./ztClient";

// ---------------------------------------------------------------------------
// ZT ZAP Tools — server-side tool definitions for the ZT Edge Management API.
//
// Each tool maps to a ZAP tool name (e.g. "zt.listIdentities") and calls
// ztClient under the hood. Auth + RBAC is handled by the API route layer.
// ---------------------------------------------------------------------------

export interface ZapToolRequest {
  name: string;
  args: Record<string, unknown>;
}

export interface ZapToolResponse<T = unknown> {
  content: T;
}

type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<unknown>;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

// ── Tool Registry ──────────────────────────────────────────────────────

const tools: Record<string, ToolHandler> = {
  // ── Dashboard ──────────────────────────────────────────────────────
  "zt.dashboard": async () => {
    const [identities, services, routers, policies, configs, sessions] =
      await Promise.all([
        ztGet<unknown[]>("/edge/management/v1/identities", { limit: "0" }),
        ztGet<unknown[]>("/edge/management/v1/services", { limit: "0" }),
        ztGet<unknown[]>("/edge/management/v1/edge-routers", { limit: "0" }),
        ztGet<unknown[]>("/edge/management/v1/service-policies", { limit: "0" }),
        ztGet<unknown[]>("/edge/management/v1/configs", { limit: "0" }),
        ztGet<unknown[]>("/edge/management/v1/sessions", { limit: "0" }),
      ]);

    return {
      identityCount: identities.meta?.pagination?.totalCount ?? 0,
      serviceCount: services.meta?.pagination?.totalCount ?? 0,
      routerCount: routers.meta?.pagination?.totalCount ?? 0,
      servicePolicyCount: policies.meta?.pagination?.totalCount ?? 0,
      configCount: configs.meta?.pagination?.totalCount ?? 0,
      sessionCount: sessions.meta?.pagination?.totalCount ?? 0,
    };
  },

  // ── Identities ─────────────────────────────────────────────────────
  "zt.listIdentities": async (args) =>
    ztGet<unknown[]>("/edge/management/v1/identities", {
      limit: String(num(args.limit, 100)),
      offset: String(num(args.offset, 0)),
      ...(args.filter ? { filter: str(args.filter) } : {}),
    }),

  "zt.getIdentity": async (args) =>
    ztGet<unknown>(
      `/edge/management/v1/identities/${encodeURIComponent(str(args.id))}`,
    ),

  "zt.createIdentity": async (args) =>
    ztPost<unknown>("/edge/management/v1/identities", {
      name: str(args.name),
      type: str(args.type, "Device"),
      isAdmin: bool(args.isAdmin),
      roleAttributes: strArr(args.roleAttributes),
      enrollment: args.enrollment ?? { ott: true },
    }),

  "zt.updateIdentity": async (args) =>
    ztPatch<unknown>(
      `/edge/management/v1/identities/${encodeURIComponent(str(args.id))}`,
      {
        ...(args.name !== undefined ? { name: str(args.name) } : {}),
        ...(args.roleAttributes !== undefined
          ? { roleAttributes: strArr(args.roleAttributes) }
          : {}),
        ...(args.tags !== undefined ? { tags: args.tags } : {}),
      },
    ),

  "zt.deleteIdentity": async (args) =>
    ztDelete<unknown>(
      `/edge/management/v1/identities/${encodeURIComponent(str(args.id))}`,
    ),

  // ── Services ───────────────────────────────────────────────────────
  "zt.listServices": async (args) =>
    ztGet<unknown[]>("/edge/management/v1/services", {
      limit: String(num(args.limit, 100)),
      offset: String(num(args.offset, 0)),
      ...(args.filter ? { filter: str(args.filter) } : {}),
    }),

  "zt.getService": async (args) =>
    ztGet<unknown>(
      `/edge/management/v1/services/${encodeURIComponent(str(args.id))}`,
    ),

  "zt.createService": async (args) =>
    ztPost<unknown>("/edge/management/v1/services", {
      name: str(args.name),
      encryptionRequired: bool(args.encryptionRequired, true),
      roleAttributes: strArr(args.roleAttributes),
      configs: strArr(args.configs),
    }),

  "zt.deleteService": async (args) =>
    ztDelete<unknown>(
      `/edge/management/v1/services/${encodeURIComponent(str(args.id))}`,
    ),

  // ── Routers (Edge Routers) ─────────────────────────────────────────
  "zt.listRouters": async (args) =>
    ztGet<unknown[]>("/edge/management/v1/edge-routers", {
      limit: String(num(args.limit, 100)),
      offset: String(num(args.offset, 0)),
      ...(args.filter ? { filter: str(args.filter) } : {}),
    }),

  "zt.getRouter": async (args) =>
    ztGet<unknown>(
      `/edge/management/v1/edge-routers/${encodeURIComponent(str(args.id))}`,
    ),

  "zt.createRouter": async (args) =>
    ztPost<unknown>("/edge/management/v1/edge-routers", {
      name: str(args.name),
      cost: num(args.cost, 0),
      noTraversal: bool(args.noTraversal),
      isTunnelerEnabled: bool(args.isTunnelerEnabled, true),
      roleAttributes: strArr(args.roleAttributes),
    }),

  "zt.deleteRouter": async (args) =>
    ztDelete<unknown>(
      `/edge/management/v1/edge-routers/${encodeURIComponent(str(args.id))}`,
    ),

  // ── Service Policies ───────────────────────────────────────────────
  "zt.listServicePolicies": async (args) =>
    ztGet<unknown[]>("/edge/management/v1/service-policies", {
      limit: String(num(args.limit, 100)),
      offset: String(num(args.offset, 0)),
      ...(args.filter ? { filter: str(args.filter) } : {}),
    }),

  "zt.createServicePolicy": async (args) =>
    ztPost<unknown>("/edge/management/v1/service-policies", {
      name: str(args.name),
      type: str(args.type),
      semantic: str(args.semantic, "AnyOf"),
      identityRoles: strArr(args.identityRoles),
      serviceRoles: strArr(args.serviceRoles),
      postureCheckRoles: strArr(args.postureCheckRoles),
    }),

  "zt.deleteServicePolicy": async (args) =>
    ztDelete<unknown>(
      `/edge/management/v1/service-policies/${encodeURIComponent(str(args.id))}`,
    ),

  // ── Configs (read-only) ────────────────────────────────────────────
  "zt.listConfigs": async (args) =>
    ztGet<unknown[]>("/edge/management/v1/configs", {
      limit: String(num(args.limit, 100)),
      offset: String(num(args.offset, 0)),
      ...(args.filter ? { filter: str(args.filter) } : {}),
    }),

  // ── Terminators (read-only) ────────────────────────────────────────
  "zt.listTerminators": async (args) =>
    ztGet<unknown[]>("/edge/management/v1/terminators", {
      limit: String(num(args.limit, 100)),
      offset: String(num(args.offset, 0)),
      ...(args.filter ? { filter: str(args.filter) } : {}),
    }),

  // ── Sessions (read-only) ──────────────────────────────────────────
  "zt.listSessions": async (args) =>
    ztGet<unknown[]>("/edge/management/v1/sessions", {
      limit: String(num(args.limit, 100)),
      offset: String(num(args.offset, 0)),
      ...(args.filter ? { filter: str(args.filter) } : {}),
    }),
};

// ── Scope lookup: which RBAC scope does each tool need? ────────────────

const TOOL_SCOPES: Record<string, "zt:read" | "zt:CUD"> = {
  "zt.dashboard": "zt:read",
  "zt.listIdentities": "zt:read",
  "zt.getIdentity": "zt:read",
  "zt.createIdentity": "zt:CUD",
  "zt.updateIdentity": "zt:CUD",
  "zt.deleteIdentity": "zt:CUD",
  "zt.listServices": "zt:read",
  "zt.getService": "zt:read",
  "zt.createService": "zt:CUD",
  "zt.deleteService": "zt:CUD",
  "zt.listRouters": "zt:read",
  "zt.getRouter": "zt:read",
  "zt.createRouter": "zt:CUD",
  "zt.deleteRouter": "zt:CUD",
  "zt.listServicePolicies": "zt:read",
  "zt.createServicePolicy": "zt:CUD",
  "zt.deleteServicePolicy": "zt:CUD",
  "zt.listConfigs": "zt:read",
  "zt.listTerminators": "zt:read",
  "zt.listSessions": "zt:read",
};

/** Get the required RBAC scope for a tool, or null if tool is unknown. */
export function getToolScope(name: string): "zt:read" | "zt:CUD" | null {
  return TOOL_SCOPES[name] ?? null;
}

/** List all available tool names. */
export function listTools(): string[] {
  return Object.keys(tools);
}

/** Dispatch a ZAP tool call. Throws if tool name is unknown. */
export async function callTool(
  request: ZapToolRequest,
): Promise<ZapToolResponse> {
  const handler = tools[request.name];
  if (!handler) {
    throw new Error(`Unknown ZAP tool: ${request.name}`);
  }
  const content = await handler(request.args);
  return { content };
}
