import { z } from "zod/v4";

// ── PaaS Container ──────────────────────────────────────────────────

export const PaasContainerStatusSchema = z.enum(["running", "stopped", "deploying", "failed", "unknown"]);
export type PaasContainerStatus = z.infer<typeof PaasContainerStatusSchema>;

export const PaasContainerSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string(),
  status: PaasContainerStatusSchema,
  cpu: z.number().optional(),
  memory: z.number().optional(),
  replicas: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  region: z.string().optional(),
  domain: z.string().optional(),
});
export type PaasContainer = z.infer<typeof PaasContainerSchema>;

// ── Pipeline Run ────────────────────────────────────────────────────

export const PipelineRunStatusSchema = z.enum(["success", "failure", "running", "pending", "cancelled"]);
export type PipelineRunStatus = z.infer<typeof PipelineRunStatusSchema>;

export const PipelineRunSchema = z.object({
  id: z.string(),
  containerId: z.string(),
  status: PipelineRunStatusSchema,
  trigger: z.string().optional(),
  commitSha: z.string().optional(),
  commitMessage: z.string().optional(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  durationMs: z.number().optional(),
  logsUrl: z.string().optional(),
});
export type PipelineRun = z.infer<typeof PipelineRunSchema>;
