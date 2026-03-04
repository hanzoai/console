import { type NextApiRequest, type NextApiResponse } from "next";
import { prisma } from "@hanzo/shared/src/db";
import { logger } from "@hanzo/shared/src/server";
import { AdminApiAuthService } from "@/src/features/admin-api/server/adminApiAuth";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";
import { getSelfHostedInstancePlanServerSide } from "@/src/features/entitlements/server/getPlan";
import { z } from "zod/v4";

const UpdateOrganizationSchema = z.object({
  name: z.string().min(3).max(60).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function formatOrg(org: {
  id: string;
  name: string;
  createdAt: Date;
  metadata: unknown;
  projects: {
    id: string;
    name: string;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }[];
}) {
  return {
    id: org.id,
    name: org.name,
    createdAt: org.createdAt.toISOString(),
    metadata: (org.metadata as Record<string, unknown>) ?? {},
    projects: org.projects.map((p) => ({
      id: p.id,
      name: p.name,
      metadata: (p.metadata as Record<string, unknown>) ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!AdminApiAuthService.handleAuth(req, res)) {
      return;
    }

    if (
      !hasEntitlementBasedOnPlan({
        plan: getSelfHostedInstancePlanServerSide(),
        entitlement: "admin-api",
      })
    ) {
      return res.status(403).json({
        error: "This feature is not available on your current plan.",
      });
    }

    if (!["GET", "PUT", "DELETE"].includes(req.method ?? "")) {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const { organizationId } = req.query;
    if (!organizationId || typeof organizationId !== "string") {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    const orgInclude = {
      projects: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    };

    if (req.method === "GET") {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: orgInclude,
      });

      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      return res.status(200).json(formatOrg(org));
    }

    if (req.method === "PUT") {
      const existing = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!existing) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const parsed = UpdateOrganizationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body: " + parsed.error.message });
      }

      const org = await prisma.organization.update({
        where: { id: organizationId },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.metadata !== undefined ? { metadata: parsed.data.metadata } : {}),
        },
        include: orgInclude,
      });

      return res.status(200).json(formatOrg(org));
    }

    if (req.method === "DELETE") {
      const existing = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          projects: { where: { deletedAt: null }, select: { id: true } },
        },
      });

      if (!existing) {
        return res.status(404).json({ error: "Organization not found" });
      }

      if (existing.projects.length > 0) {
        return res.status(400).json({
          error: "Cannot delete organization with existing projects. Delete all projects first.",
        });
      }

      await prisma.organization.delete({
        where: { id: organizationId },
      });

      return res.status(200).json({ success: true });
    }
  } catch (e) {
    logger.error("Failed to process organization request", e);
    res.status(500).json({ error: "Internal server error" });
  }
}
