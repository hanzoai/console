import { z } from "zod/v4";

// ── Service Health ──────────────────────────────────────────────────

export const ServiceHealthStatusSchema = z.enum(["healthy", "degraded", "down", "unknown"]);
export type ServiceHealthStatus = z.infer<typeof ServiceHealthStatusSchema>;

export const ServiceHealthSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: ServiceHealthStatusSchema,
  cpu: z.number().optional(),
  memory: z.number().optional(),
  memoryLimit: z.number().optional(),
  replicas: z.number().optional(),
  readyReplicas: z.number().optional(),
  image: z.string().optional(),
  region: z.string().optional(),
  updatedAt: z.string(),
  domain: z.string().optional(),
});
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

// ── Deployment Event ────────────────────────────────────────────────

export const DeploymentEventSchema = z.object({
  id: z.string(),
  serviceName: z.string(),
  event: z.string(),
  status: z.string(),
  timestamp: z.string(),
  image: z.string().optional(),
  commitSha: z.string().optional(),
});
export type DeploymentEvent = z.infer<typeof DeploymentEventSchema>;
