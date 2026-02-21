import { z } from "zod/v4";

// ── Identities ──────────────────────────────────────────────────────

export const ZtIdentitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.object({
    id: z.string(),
    name: z.string(),
  }),
  isOnline: z.boolean().default(false),
  isAdmin: z.boolean().default(false),
  enrollment: z.record(z.string(), z.unknown()).optional(),
  roleAttributes: z.array(z.string()).nullable().optional(),
  hasApiSession: z.boolean().default(false),
  hasEdgeRouterConnection: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ZtIdentity = z.infer<typeof ZtIdentitySchema>;

export const CreateZtIdentityInput = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  type: z.enum(["Device", "User", "Service", "Router"]).default("Device"),
  isAdmin: z.boolean().default(false),
  roleAttributes: z.array(z.string()).optional(),
  enrollment: z
    .object({ ott: z.boolean().default(true) })
    .default({ ott: true }),
});
export type CreateZtIdentityInput = z.infer<typeof CreateZtIdentityInput>;

export const DeleteZtIdentityInput = z.object({
  projectId: z.string(),
  id: z.string(),
});
export type DeleteZtIdentityInput = z.infer<typeof DeleteZtIdentityInput>;

export const UpdateZtIdentityInput = z.object({
  projectId: z.string(),
  id: z.string(),
  name: z.string().min(1).optional(),
  roleAttributes: z.array(z.string()).nullable().optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateZtIdentityInput = z.infer<typeof UpdateZtIdentityInput>;

// ── Services ────────────────────────────────────────────────────────

export const ZtServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  encryptionRequired: z.boolean().default(true),
  terminatorStrategy: z.string().optional(),
  roleAttributes: z.array(z.string()).nullable().optional(),
  configs: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ZtService = z.infer<typeof ZtServiceSchema>;

export const CreateZtServiceInput = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  encryptionRequired: z.boolean().default(true),
  roleAttributes: z.array(z.string()).optional(),
  configs: z.array(z.string()).optional(),
});
export type CreateZtServiceInput = z.infer<typeof CreateZtServiceInput>;

export const DeleteZtServiceInput = z.object({
  projectId: z.string(),
  id: z.string(),
});
export type DeleteZtServiceInput = z.infer<typeof DeleteZtServiceInput>;

// ── Routers (Edge Routers) ──────────────────────────────────────────

export const ZtRouterSchema = z.object({
  id: z.string(),
  name: z.string(),
  isOnline: z.boolean().default(false),
  isVerified: z.boolean().default(false),
  fingerprint: z.string().nullable().optional(),
  cost: z.number().default(0),
  noTraversal: z.boolean().default(false),
  isTunnelerEnabled: z.boolean().default(false),
  roleAttributes: z.array(z.string()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ZtRouter = z.infer<typeof ZtRouterSchema>;

export const CreateZtRouterInput = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  cost: z.number().default(0),
  noTraversal: z.boolean().default(false),
  isTunnelerEnabled: z.boolean().default(true),
  roleAttributes: z.array(z.string()).optional(),
});
export type CreateZtRouterInput = z.infer<typeof CreateZtRouterInput>;

export const DeleteZtRouterInput = z.object({
  projectId: z.string(),
  id: z.string(),
});
export type DeleteZtRouterInput = z.infer<typeof DeleteZtRouterInput>;

// ── Service Policies ────────────────────────────────────────────────

export const ZtServicePolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["Bind", "Dial"]),
  semantic: z.enum(["AllOf", "AnyOf"]).default("AnyOf"),
  identityRoles: z.array(z.string()).default([]),
  serviceRoles: z.array(z.string()).default([]),
  postureCheckRoles: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ZtServicePolicy = z.infer<typeof ZtServicePolicySchema>;

export const CreateZtServicePolicyInput = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  type: z.enum(["Bind", "Dial"]),
  semantic: z.enum(["AllOf", "AnyOf"]).default("AnyOf"),
  identityRoles: z.array(z.string()).default([]),
  serviceRoles: z.array(z.string()).default([]),
  postureCheckRoles: z.array(z.string()).optional(),
});
export type CreateZtServicePolicyInput = z.infer<typeof CreateZtServicePolicyInput>;

export const DeleteZtServicePolicyInput = z.object({
  projectId: z.string(),
  id: z.string(),
});
export type DeleteZtServicePolicyInput = z.infer<typeof DeleteZtServicePolicyInput>;

// ── Configs ─────────────────────────────────────────────────────────

export const ZtConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  configTypeId: z.string(),
  configType: z
    .object({ id: z.string(), name: z.string() })
    .optional(),
  data: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ZtConfig = z.infer<typeof ZtConfigSchema>;

// ── Terminators ─────────────────────────────────────────────────────

export const ZtTerminatorSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  service: z.object({ id: z.string(), name: z.string() }).optional(),
  routerId: z.string(),
  router: z.object({ id: z.string(), name: z.string() }).optional(),
  binding: z.string(),
  address: z.string(),
  cost: z.number().default(0),
  precedence: z.string().default("default"),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ZtTerminator = z.infer<typeof ZtTerminatorSchema>;

// ── Sessions ────────────────────────────────────────────────────────

export const ZtSessionSchema = z.object({
  id: z.string(),
  token: z.string(),
  identityId: z.string(),
  identity: z.object({ id: z.string(), name: z.string() }).optional(),
  serviceId: z.string(),
  service: z.object({ id: z.string(), name: z.string() }).optional(),
  type: z.enum(["Dial", "Bind"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ZtSession = z.infer<typeof ZtSessionSchema>;

// ── Dashboard Summary ───────────────────────────────────────────────

export const ZtDashboardSummary = z.object({
  identityCount: z.number().default(0),
  serviceCount: z.number().default(0),
  routerCount: z.number().default(0),
  servicePolicyCount: z.number().default(0),
  configCount: z.number().default(0),
  sessionCount: z.number().default(0),
  onlineRouters: z.number().default(0),
  onlineIdentities: z.number().default(0),
});
export type ZtDashboardSummary = z.infer<typeof ZtDashboardSummary>;
