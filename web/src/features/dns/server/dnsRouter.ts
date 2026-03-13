import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/src/server/api/trpc";
import {
  CreateDnsZoneInput,
  DeleteDnsZoneInput,
  CreateDnsRecordInput,
  UpdateDnsRecordInput,
  DeleteDnsRecordInput,
} from "../types";

export const dnsRouter = createTRPCRouter({
  // ── Zones ──────────────────────────────────────────────────────

  listZones: protectedOrganizationProcedure.input(z.object({ orgId: z.string() })).query(async ({ input, ctx }) => {
    return ctx.prisma.dnsZone.findMany({
      where: { orgId: input.orgId },
      include: { _count: { select: { records: true } } },
      orderBy: { name: "asc" },
    });
  }),

  getZone: protectedOrganizationProcedure
    .input(z.object({ orgId: z.string(), zoneId: z.string() }))
    .query(async ({ input, ctx }) => {
      const zone = await ctx.prisma.dnsZone.findFirst({
        where: { id: input.zoneId, orgId: input.orgId },
        include: { _count: { select: { records: true } } },
      });
      if (!zone) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Zone not found" });
      }
      return zone;
    }),

  createZone: protectedOrganizationProcedure.input(CreateDnsZoneInput).mutation(async ({ input, ctx }) => {
    const existing = await ctx.prisma.dnsZone.findFirst({
      where: { orgId: input.orgId, name: input.name },
    });
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Zone "${input.name}" already exists`,
      });
    }

    const zone = await ctx.prisma.dnsZone.create({
      data: {
        orgId: input.orgId,
        name: input.name,
        cloudflareZoneId: input.cloudflareZoneId,
      },
    });

    await ctx.prisma.dnsAuditLog.create({
      data: {
        zoneId: zone.id,
        userId: ctx.session.user.id,
        action: "create_zone",
        details: { name: input.name },
      },
    });

    return zone;
  }),

  deleteZone: protectedOrganizationProcedure.input(DeleteDnsZoneInput).mutation(async ({ input, ctx }) => {
    const zone = await ctx.prisma.dnsZone.findFirst({
      where: { id: input.zoneId, orgId: input.orgId },
    });
    if (!zone) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Zone not found" });
    }

    await ctx.prisma.dnsAuditLog.create({
      data: {
        zoneId: zone.id,
        userId: ctx.session.user.id,
        action: "delete_zone",
        details: { name: zone.name },
      },
    });

    await ctx.prisma.dnsZone.delete({ where: { id: input.zoneId } });

    return { success: true };
  }),

  // ── Records ────────────────────────────────────────────────────

  listRecords: protectedOrganizationProcedure
    .input(z.object({ orgId: z.string(), zoneId: z.string() }))
    .query(async ({ input, ctx }) => {
      const zone = await ctx.prisma.dnsZone.findFirst({
        where: { id: input.zoneId, orgId: input.orgId },
      });
      if (!zone) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Zone not found" });
      }

      return ctx.prisma.dnsRecord.findMany({
        where: { zoneId: input.zoneId },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      });
    }),

  createRecord: protectedOrganizationProcedure.input(CreateDnsRecordInput).mutation(async ({ input, ctx }) => {
    const zone = await ctx.prisma.dnsZone.findFirst({
      where: { id: input.zoneId, orgId: input.orgId },
    });
    if (!zone) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Zone not found" });
    }

    const record = await ctx.prisma.dnsRecord.create({
      data: {
        zoneId: input.zoneId,
        name: input.name,
        type: input.type,
        content: input.content,
        ttl: input.ttl,
        priority: input.priority,
        proxied: input.proxied,
        syncToCloudflare: input.syncToCloudflare,
      },
    });

    await ctx.prisma.dnsAuditLog.create({
      data: {
        zoneId: input.zoneId,
        userId: ctx.session.user.id,
        action: "create_record",
        details: {
          name: input.name,
          type: input.type,
          content: input.content,
        },
      },
    });

    return record;
  }),

  updateRecord: protectedOrganizationProcedure.input(UpdateDnsRecordInput).mutation(async ({ input, ctx }) => {
    const zone = await ctx.prisma.dnsZone.findFirst({
      where: { id: input.zoneId, orgId: input.orgId },
    });
    if (!zone) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Zone not found" });
    }

    const existing = await ctx.prisma.dnsRecord.findFirst({
      where: { id: input.recordId, zoneId: input.zoneId },
    });
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Record not found",
      });
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.type !== undefined) data.type = input.type;
    if (input.content !== undefined) data.content = input.content;
    if (input.ttl !== undefined) data.ttl = input.ttl;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.proxied !== undefined) data.proxied = input.proxied;
    if (input.syncToCloudflare !== undefined) data.syncToCloudflare = input.syncToCloudflare;

    const record = await ctx.prisma.dnsRecord.update({
      where: { id: input.recordId },
      data,
    });

    await ctx.prisma.dnsAuditLog.create({
      data: {
        zoneId: input.zoneId,
        userId: ctx.session.user.id,
        action: "update_record",
        details: { recordId: input.recordId, changes: data },
      },
    });

    return record;
  }),

  deleteRecord: protectedOrganizationProcedure.input(DeleteDnsRecordInput).mutation(async ({ input, ctx }) => {
    const zone = await ctx.prisma.dnsZone.findFirst({
      where: { id: input.zoneId, orgId: input.orgId },
    });
    if (!zone) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Zone not found" });
    }

    const existing = await ctx.prisma.dnsRecord.findFirst({
      where: { id: input.recordId, zoneId: input.zoneId },
    });
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Record not found",
      });
    }

    await ctx.prisma.dnsAuditLog.create({
      data: {
        zoneId: input.zoneId,
        userId: ctx.session.user.id,
        action: "delete_record",
        details: {
          name: existing.name,
          type: existing.type,
          content: existing.content,
        },
      },
    });

    await ctx.prisma.dnsRecord.delete({ where: { id: input.recordId } });

    return { success: true };
  }),

  // ── Audit Logs ─────────────────────────────────────────────────

  listAuditLogs: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        zoneId: z.string(),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const zone = await ctx.prisma.dnsZone.findFirst({
        where: { id: input.zoneId, orgId: input.orgId },
      });
      if (!zone) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Zone not found" });
      }

      const logs = await ctx.prisma.dnsAuditLog.findMany({
        where: { zoneId: input.zoneId },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (logs.length > input.limit) {
        const next = logs.pop();
        nextCursor = next?.id;
      }

      return { logs, nextCursor };
    }),
});
