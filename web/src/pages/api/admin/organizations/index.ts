import { type NextApiRequest, type NextApiResponse } from "next";
import { prisma } from "@hanzo/shared/src/db";
import { logger } from "@hanzo/shared/src/server";
import { AdminApiAuthService } from "@/src/features/admin-api/server/adminApiAuth";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";
import { getSelfHostedInstancePlanServerSide } from "@/src/features/entitlements/server/getPlan";
import { z } from "zod/v4";

const CreateOrganizationSchema = z.object({
  name: z.string().min(3).max(60),
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
    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

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

    if (req.method === "POST") {
      const parsed = CreateOrganizationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body: " + parsed.error.message });
      }

      const org = await prisma.organization.create({
        data: {
          name: parsed.data.name,
          metadata: parsed.data.metadata ?? undefined,
        },
        include: {
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
        },
      });

      return res.status(201).json(formatOrg(org));
    }

    if (req.method === "GET") {
      const orgs = await prisma.organization.findMany({
        include: {
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
        },
      });

      return res.status(200).json({
        organizations: orgs.map(formatOrg),
      });
    }
  } catch (e) {
    logger.error("Failed to process organization request", e);
    res.status(500).json({ error: "Internal server error" });
  }
}
