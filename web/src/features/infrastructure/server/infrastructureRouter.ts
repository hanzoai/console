import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProjectProcedure } from "@/src/server/api/trpc";
import { env } from "@/src/env.mjs";
import { paasGet } from "@/src/features/platform/server/paasClient";
import type { ServiceHealth, ServiceHealthStatus, DeploymentEvent } from "../types";

// ---------------------------------------------------------------------------
// Infrastructure Router
//
// Aggregates container status from PaaS into a service health grid
// and derives deployment events from pipeline history.
// ---------------------------------------------------------------------------

function resolvePaasOrgId(): string {
  const id = env.PAAS_ORG_ID;
  if (!id) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "PaaS org ID not configured. Set PAAS_ORG_ID env var.",
    });
  }
  return id;
}

function resolvePaasProjectId(): string {
  const id = env.PAAS_PROJECT_ID;
  if (!id) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "PaaS project ID not configured. Set PAAS_PROJECT_ID env var.",
    });
  }
  return id;
}

function resolvePaasEnvId(): string {
  const id = env.PAAS_ENV_ID;
  if (!id) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "PaaS env ID not configured. Set PAAS_ENV_ID env var.",
    });
  }
  return id;
}

function buildContainerPath(suffix?: string): string {
  const orgId = resolvePaasOrgId();
  const projId = resolvePaasProjectId();
  const envId = resolvePaasEnvId();
  const base = `/v1/org/${orgId}/project/${projId}/env/${envId}/container`;
  return suffix ? `${base}/${suffix}` : base;
}

export const infrastructureRouter = createTRPCRouter({
  getServiceHealth: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async () => {
    const raw = await paasGet<unknown>(buildContainerPath());
    const containers = Array.isArray(raw) ? raw : [];

    return containers.map((c: Record<string, unknown>): ServiceHealth => {
      const status = deriveHealthStatus(c);
      const memVal = typeof c.memory === "number" ? c.memory : undefined;
      const memLimit =
        typeof c.memoryLimit === "number"
          ? c.memoryLimit
          : typeof c.memory_limit === "number"
            ? c.memory_limit
            : undefined;

      return {
        id: String(c.id ?? c._id ?? ""),
        name: String(c.name ?? c.serviceName ?? "unknown"),
        status,
        cpu: typeof c.cpu === "number" ? c.cpu : undefined,
        memory: memVal,
        memoryLimit: memLimit,
        replicas: typeof c.replicas === "number" ? c.replicas : undefined,
        readyReplicas:
          typeof c.readyReplicas === "number"
            ? c.readyReplicas
            : typeof c.ready_replicas === "number"
              ? c.ready_replicas
              : undefined,
        image: typeof c.image === "string" ? c.image : typeof c.dockerImage === "string" ? c.dockerImage : undefined,
        region: typeof c.region === "string" ? c.region : undefined,
        updatedAt: String(c.updatedAt ?? c.updated_at ?? new Date().toISOString()),
        domain:
          typeof c.domain === "string" ? c.domain : typeof c.customDomain === "string" ? c.customDomain : undefined,
      };
    });
  }),

  getDeploymentEvents: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async () => {
    const raw = await paasGet<unknown>(buildContainerPath());
    const containers = Array.isArray(raw) ? raw : [];

    // Collect pipeline events from all containers
    const events: DeploymentEvent[] = [];
    for (const c of containers) {
      const containerId = String(c.id ?? c._id ?? "");
      const containerName = String(c.name ?? c.serviceName ?? "unknown");

      try {
        const pipelines = await paasGet<unknown>(buildContainerPath(`${containerId}/pipelines`));
        const runs = Array.isArray(pipelines) ? pipelines : [];
        for (const r of runs.slice(0, 5) as Record<string, unknown>[]) {
          events.push({
            id: String(r.id ?? r._id ?? `${containerId}-${events.length}`),
            serviceName: containerName,
            event: String(r.trigger ?? "deploy"),
            status: String(r.status ?? r.state ?? "unknown"),
            timestamp: String(r.startedAt ?? r.started_at ?? r.createdAt ?? new Date().toISOString()),
            image: typeof r.image === "string" ? r.image : undefined,
            commitSha:
              typeof r.commitSha === "string"
                ? r.commitSha
                : typeof r.commit_sha === "string"
                  ? r.commit_sha
                  : undefined,
          });
        }
      } catch {
        // Pipeline endpoint may not exist for all containers — skip gracefully
      }
    }

    // Sort by timestamp descending, return latest 20
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events.slice(0, 20);
  }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveHealthStatus(c: Record<string, unknown>): ServiceHealthStatus {
  const raw = String(c.status ?? c.state ?? "").toLowerCase();

  // Check replicas
  const replicas = typeof c.replicas === "number" ? c.replicas : 0;
  const ready =
    typeof c.readyReplicas === "number"
      ? c.readyReplicas
      : typeof c.ready_replicas === "number"
        ? c.ready_replicas
        : undefined;

  if (raw.includes("fail") || raw.includes("error") || raw.includes("crash")) return "down";
  if (raw.includes("stop") || raw === "inactive") return "down";

  if (raw.includes("run") || raw === "active") {
    // If ready replicas info is available, check if degraded
    if (ready !== undefined && replicas > 0 && ready < replicas) return "degraded";

    // Check memory pressure (> 90% usage)
    const mem = typeof c.memory === "number" ? c.memory : undefined;
    const memLimit =
      typeof c.memoryLimit === "number"
        ? c.memoryLimit
        : typeof c.memory_limit === "number"
          ? c.memory_limit
          : undefined;
    if (mem !== undefined && memLimit !== undefined && memLimit > 0 && mem / memLimit > 0.9) return "degraded";

    return "healthy";
  }

  if (raw.includes("deploy") || raw.includes("pend") || raw.includes("build")) return "degraded";

  return "unknown";
}
