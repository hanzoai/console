import { z } from "zod/v4";

// ── Record Types ────────────────────────────────────────────────

export const DnsRecordTypeEnum = z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "NS", "CAA"]);
export type DnsRecordType = z.infer<typeof DnsRecordTypeEnum>;

// ── Zone Schemas ────────────────────────────────────────────────

export const DnsZoneSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  status: z.string(),
  cloudflareZoneId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  _count: z
    .object({
      records: z.number(),
    })
    .optional(),
});
export type DnsZone = z.infer<typeof DnsZoneSchema>;

export const CreateDnsZoneInput = z.object({
  orgId: z.string(),
  name: z
    .string()
    .min(1, "Domain name is required")
    .regex(/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/, "Invalid domain name format"),
  cloudflareZoneId: z.string().optional(),
});
export type CreateDnsZoneInput = z.infer<typeof CreateDnsZoneInput>;

export const DeleteDnsZoneInput = z.object({
  orgId: z.string(),
  zoneId: z.string(),
});
export type DeleteDnsZoneInput = z.infer<typeof DeleteDnsZoneInput>;

// ── Record Schemas ──────────────────────────────────────────────

export const DnsRecordSchema = z.object({
  id: z.string(),
  zoneId: z.string(),
  name: z.string(),
  type: z.string(),
  content: z.string(),
  ttl: z.number(),
  priority: z.number().nullable(),
  proxied: z.boolean(),
  syncToCloudflare: z.boolean(),
  cloudflareRecordId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type DnsRecord = z.infer<typeof DnsRecordSchema>;

export const CreateDnsRecordInput = z.object({
  orgId: z.string(),
  zoneId: z.string(),
  name: z.string().min(1, "Record name is required"),
  type: DnsRecordTypeEnum,
  content: z.string().min(1, "Content is required"),
  ttl: z.number().int().min(1).max(86400).default(300),
  priority: z.number().int().min(0).max(65535).optional(),
  proxied: z.boolean().default(false),
  syncToCloudflare: z.boolean().default(false),
});
export type CreateDnsRecordInput = z.infer<typeof CreateDnsRecordInput>;

export const UpdateDnsRecordInput = z.object({
  orgId: z.string(),
  zoneId: z.string(),
  recordId: z.string(),
  name: z.string().min(1).optional(),
  type: DnsRecordTypeEnum.optional(),
  content: z.string().min(1).optional(),
  ttl: z.number().int().min(1).max(86400).optional(),
  priority: z.number().int().min(0).max(65535).nullable().optional(),
  proxied: z.boolean().optional(),
  syncToCloudflare: z.boolean().optional(),
});
export type UpdateDnsRecordInput = z.infer<typeof UpdateDnsRecordInput>;

export const DeleteDnsRecordInput = z.object({
  orgId: z.string(),
  zoneId: z.string(),
  recordId: z.string(),
});
export type DeleteDnsRecordInput = z.infer<typeof DeleteDnsRecordInput>;

// ── Audit Log ───────────────────────────────────────────────────

export const DnsAuditLogSchema = z.object({
  id: z.string(),
  zoneId: z.string(),
  userId: z.string(),
  action: z.string(),
  details: z.unknown().nullable(),
  createdAt: z.date(),
});
export type DnsAuditLog = z.infer<typeof DnsAuditLogSchema>;
