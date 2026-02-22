import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProjectProcedure } from "@/src/server/api/trpc";
import { paasGet, paasPost } from "./paasClient";
import { env } from "@/src/env.mjs";
import type { PaasContainer, PipelineRun } from "../types";

// ---------------------------------------------------------------------------
// PaaS org/project/env IDs — resolved from env vars or org metadata
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

// ---------------------------------------------------------------------------
// Platform Router
// ---------------------------------------------------------------------------

export const platformRouter = createTRPCRouter({
  listContainers: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async () => {
    const raw = await paasGet<unknown>(buildContainerPath());
    const containers = Array.isArray(raw) ? raw : [];
    return containers.map(
      (c: Record<string, unknown>): PaasContainer => ({
        id: String(c.id ?? c._id ?? ""),
        name: String(c.name ?? c.serviceName ?? "unknown"),
        image: String(c.image ?? c.dockerImage ?? ""),
        status: mapContainerStatus(c.status ?? c.state),
        cpu: typeof c.cpu === "number" ? c.cpu : undefined,
        memory: typeof c.memory === "number" ? c.memory : undefined,
        replicas: typeof c.replicas === "number" ? c.replicas : undefined,
        createdAt: String(c.createdAt ?? c.created_at ?? new Date().toISOString()),
        updatedAt: String(c.updatedAt ?? c.updated_at ?? new Date().toISOString()),
        region: typeof c.region === "string" ? c.region : undefined,
        domain:
          typeof c.domain === "string" ? c.domain : typeof c.customDomain === "string" ? c.customDomain : undefined,
      }),
    );
  }),

  getContainer: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), containerId: z.string() }))
    .query(async ({ input }) => {
      const raw = await paasGet<Record<string, unknown>>(buildContainerPath(input.containerId));
      return {
        id: String(raw.id ?? raw._id ?? ""),
        name: String(raw.name ?? raw.serviceName ?? "unknown"),
        image: String(raw.image ?? raw.dockerImage ?? ""),
        status: mapContainerStatus(raw.status ?? raw.state),
        cpu: typeof raw.cpu === "number" ? raw.cpu : undefined,
        memory: typeof raw.memory === "number" ? raw.memory : undefined,
        replicas: typeof raw.replicas === "number" ? raw.replicas : undefined,
        createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
        updatedAt: String(raw.updatedAt ?? raw.updated_at ?? new Date().toISOString()),
        region: typeof raw.region === "string" ? raw.region : undefined,
        domain:
          typeof raw.domain === "string"
            ? raw.domain
            : typeof raw.customDomain === "string"
              ? raw.customDomain
              : undefined,
      } satisfies PaasContainer;
    }),

  listPipelines: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), containerId: z.string() }))
    .query(async ({ input }) => {
      const raw = await paasGet<unknown>(buildContainerPath(`${input.containerId}/pipelines`));
      const runs = Array.isArray(raw) ? raw : [];
      return runs.map(
        (r: Record<string, unknown>): PipelineRun => ({
          id: String(r.id ?? r._id ?? ""),
          containerId: input.containerId,
          status: mapPipelineStatus(r.status ?? r.state),
          trigger: typeof r.trigger === "string" ? r.trigger : undefined,
          commitSha:
            typeof r.commitSha === "string" ? r.commitSha : typeof r.commit_sha === "string" ? r.commit_sha : undefined,
          commitMessage:
            typeof r.commitMessage === "string"
              ? r.commitMessage
              : typeof r.commit_message === "string"
                ? r.commit_message
                : undefined,
          startedAt: String(r.startedAt ?? r.started_at ?? r.createdAt ?? new Date().toISOString()),
          finishedAt:
            typeof r.finishedAt === "string"
              ? r.finishedAt
              : typeof r.finished_at === "string"
                ? r.finished_at
                : undefined,
          durationMs:
            typeof r.durationMs === "number"
              ? r.durationMs
              : typeof r.duration_ms === "number"
                ? r.duration_ms
                : undefined,
          logsUrl: typeof r.logsUrl === "string" ? r.logsUrl : typeof r.logs_url === "string" ? r.logs_url : undefined,
        }),
      );
    }),

  triggerBuild: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), containerId: z.string() }))
    .mutation(async ({ input }) => {
      return paasPost<{ ok: boolean }>(buildContainerPath(`${input.containerId}/redeploy`));
    }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapContainerStatus(raw: unknown): PaasContainer["status"] {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("run") || s === "active") return "running";
  if (s.includes("stop") || s === "inactive") return "stopped";
  if (s.includes("deploy") || s.includes("build") || s.includes("pend")) return "deploying";
  if (s.includes("fail") || s.includes("error") || s.includes("crash")) return "failed";
  return "unknown";
}

function mapPipelineStatus(raw: unknown): PipelineRun["status"] {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("success") || s === "completed") return "success";
  if (s.includes("fail") || s.includes("error")) return "failure";
  if (s.includes("run") || s.includes("active") || s.includes("progress")) return "running";
  if (s.includes("pend") || s.includes("queue")) return "pending";
  if (s.includes("cancel")) return "cancelled";
  return "pending";
}
