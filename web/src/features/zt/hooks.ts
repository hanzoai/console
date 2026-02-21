import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { zapCallZt } from "./zapClient";
import type { ZtDashboardSummary } from "./types";

// ---------------------------------------------------------------------------
// ZT React Query hooks — calls ZAP tools via /api/zap/zt
// ---------------------------------------------------------------------------

/** ZT API list envelope returned by list tools. */
interface ZtListResult {
  data: Record<string, unknown>[];
  meta?: {
    pagination?: {
      limit: number;
      offset: number;
      totalCount: number;
    };
  };
}

/** ZT API single-item envelope returned by get tools. */
interface ZtItemResult {
  data: Record<string, unknown>;
}

// ── Query key factory ───────────────────────────────────────────────────

const ztKeys = {
  all: ["zt"] as const,
  dashboard: (projectId: string) => ["zt", "dashboard", projectId] as const,
  identities: (projectId: string) => ["zt", "identities", projectId] as const,
  identity: (projectId: string, id: string) =>
    ["zt", "identity", projectId, id] as const,
  services: (projectId: string) => ["zt", "services", projectId] as const,
  service: (projectId: string, id: string) =>
    ["zt", "service", projectId, id] as const,
  routers: (projectId: string) => ["zt", "routers", projectId] as const,
  router: (projectId: string, id: string) =>
    ["zt", "router", projectId, id] as const,
  servicePolicies: (projectId: string) =>
    ["zt", "servicePolicies", projectId] as const,
  configs: (projectId: string) => ["zt", "configs", projectId] as const,
  terminators: (projectId: string) =>
    ["zt", "terminators", projectId] as const,
  sessions: (projectId: string) => ["zt", "sessions", projectId] as const,
};

// ── Dashboard ───────────────────────────────────────────────────────

export function useZtDashboard(projectId: string) {
  return useQuery({
    queryKey: ztKeys.dashboard(projectId),
    queryFn: () => zapCallZt<ZtDashboardSummary>("zt.dashboard", { projectId }),
    enabled: !!projectId,
  });
}

// ── Identities ──────────────────────────────────────────────────────

export function useZtIdentities(
  projectId: string,
  limit = 100,
  offset = 0,
  filter?: string,
) {
  return useQuery({
    queryKey: [...ztKeys.identities(projectId), limit, offset, filter],
    queryFn: () =>
      zapCallZt<ZtListResult>("zt.listIdentities", { projectId, limit, offset, filter }),
    enabled: !!projectId,
  });
}

export function useZtIdentity(projectId: string, id: string) {
  return useQuery({
    queryKey: ztKeys.identity(projectId, id),
    queryFn: () => zapCallZt<ZtItemResult>("zt.getIdentity", { projectId, id }),
    enabled: !!projectId && !!id,
  });
}

export function useCreateZtIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      zapCallZt("zt.createIdentity", args),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: ztKeys.identities(args.projectId as string) });
      void qc.invalidateQueries({ queryKey: ztKeys.dashboard(args.projectId as string) });
    },
  });
}

export function useUpdateZtIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      zapCallZt("zt.updateIdentity", args),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: ztKeys.identities(args.projectId as string) });
      void qc.invalidateQueries({
        queryKey: ztKeys.identity(args.projectId as string, args.id as string),
      });
    },
  });
}

export function useDeleteZtIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      zapCallZt("zt.deleteIdentity", args),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: ztKeys.identities(args.projectId as string) });
      void qc.invalidateQueries({ queryKey: ztKeys.dashboard(args.projectId as string) });
    },
  });
}

// ── Services ────────────────────────────────────────────────────────

export function useZtServices(
  projectId: string,
  limit = 100,
  offset = 0,
  filter?: string,
) {
  return useQuery({
    queryKey: [...ztKeys.services(projectId), limit, offset, filter],
    queryFn: () =>
      zapCallZt<ZtListResult>("zt.listServices", { projectId, limit, offset, filter }),
    enabled: !!projectId,
  });
}

export function useZtService(projectId: string, id: string) {
  return useQuery({
    queryKey: ztKeys.service(projectId, id),
    queryFn: () => zapCallZt<ZtItemResult>("zt.getService", { projectId, id }),
    enabled: !!projectId && !!id,
  });
}

export function useCreateZtService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      zapCallZt("zt.createService", args),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: ztKeys.services(args.projectId as string) });
      void qc.invalidateQueries({ queryKey: ztKeys.dashboard(args.projectId as string) });
    },
  });
}

export function useDeleteZtService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      zapCallZt("zt.deleteService", args),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: ztKeys.services(args.projectId as string) });
      void qc.invalidateQueries({ queryKey: ztKeys.dashboard(args.projectId as string) });
    },
  });
}

// ── Routers ─────────────────────────────────────────────────────────

export function useZtRouters(
  projectId: string,
  limit = 100,
  offset = 0,
  filter?: string,
) {
  return useQuery({
    queryKey: [...ztKeys.routers(projectId), limit, offset, filter],
    queryFn: () =>
      zapCallZt<ZtListResult>("zt.listRouters", { projectId, limit, offset, filter }),
    enabled: !!projectId,
  });
}

export function useZtRouter(projectId: string, id: string) {
  return useQuery({
    queryKey: ztKeys.router(projectId, id),
    queryFn: () => zapCallZt<ZtItemResult>("zt.getRouter", { projectId, id }),
    enabled: !!projectId && !!id,
  });
}

export function useCreateZtRouter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      zapCallZt("zt.createRouter", args),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: ztKeys.routers(args.projectId as string) });
      void qc.invalidateQueries({ queryKey: ztKeys.dashboard(args.projectId as string) });
    },
  });
}

export function useDeleteZtRouter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      zapCallZt("zt.deleteRouter", args),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: ztKeys.routers(args.projectId as string) });
      void qc.invalidateQueries({ queryKey: ztKeys.dashboard(args.projectId as string) });
    },
  });
}

// ── Service Policies ────────────────────────────────────────────────

export function useZtServicePolicies(
  projectId: string,
  limit = 100,
  offset = 0,
  filter?: string,
) {
  return useQuery({
    queryKey: [...ztKeys.servicePolicies(projectId), limit, offset, filter],
    queryFn: () =>
      zapCallZt<ZtListResult>("zt.listServicePolicies", { projectId, limit, offset, filter }),
    enabled: !!projectId,
  });
}

export function useCreateZtServicePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      zapCallZt("zt.createServicePolicy", args),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({
        queryKey: ztKeys.servicePolicies(args.projectId as string),
      });
      void qc.invalidateQueries({ queryKey: ztKeys.dashboard(args.projectId as string) });
    },
  });
}

export function useDeleteZtServicePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      zapCallZt("zt.deleteServicePolicy", args),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({
        queryKey: ztKeys.servicePolicies(args.projectId as string),
      });
      void qc.invalidateQueries({ queryKey: ztKeys.dashboard(args.projectId as string) });
    },
  });
}

// ── Configs ─────────────────────────────────────────────────────────

export function useZtConfigs(
  projectId: string,
  limit = 100,
  offset = 0,
  filter?: string,
) {
  return useQuery({
    queryKey: [...ztKeys.configs(projectId), limit, offset, filter],
    queryFn: () =>
      zapCallZt<ZtListResult>("zt.listConfigs", { projectId, limit, offset, filter }),
    enabled: !!projectId,
  });
}

// ── Terminators ─────────────────────────────────────────────────────

export function useZtTerminators(
  projectId: string,
  limit = 100,
  offset = 0,
  filter?: string,
) {
  return useQuery({
    queryKey: [...ztKeys.terminators(projectId), limit, offset, filter],
    queryFn: () =>
      zapCallZt<ZtListResult>("zt.listTerminators", { projectId, limit, offset, filter }),
    enabled: !!projectId,
  });
}

// ── Sessions ────────────────────────────────────────────────────────

export function useZtSessions(
  projectId: string,
  limit = 100,
  offset = 0,
  filter?: string,
) {
  return useQuery({
    queryKey: [...ztKeys.sessions(projectId), limit, offset, filter],
    queryFn: () =>
      zapCallZt<ZtListResult>("zt.listSessions", { projectId, limit, offset, filter }),
    enabled: !!projectId,
  });
}
