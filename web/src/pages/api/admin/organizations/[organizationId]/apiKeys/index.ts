import { type NextApiRequest, type NextApiResponse } from "next";
import { prisma } from "@hanzo/shared/src/db";
import { logger, createAndAddApiKeysToDb } from "@hanzo/shared/src/server";
import { AdminApiAuthService } from "@/src/features/admin-api/server/adminApiAuth";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";
import { getSelfHostedInstancePlanServerSide } from "@/src/features/entitlements/server/getPlan";

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

    const { organizationId } = req.query;
    if (!organizationId || typeof organizationId !== "string") {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    // Verify organization exists
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    if (req.method === "GET") {
      const apiKeys = await prisma.apiKey.findMany({
        where: { orgId: organizationId },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          lastUsedAt: true,
          note: true,
          publicKey: true,
          displaySecretKey: true,
        },
        orderBy: { createdAt: "asc" },
      });

      return res.status(200).json({
        apiKeys: apiKeys.map((key) => ({
          id: key.id,
          createdAt: key.createdAt.toISOString(),
          expiresAt: key.expiresAt?.toISOString() ?? null,
          lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          note: key.note,
          publicKey: key.publicKey,
          displaySecretKey: key.displaySecretKey,
        })),
      });
    }

    if (req.method === "POST") {
      const note = req.body?.note as string | undefined;

      const result = await createAndAddApiKeysToDb({
        prisma,
        entityId: organizationId,
        scope: "ORGANIZATION",
        note,
      });

      return res.status(201).json({
        id: result.id,
        createdAt: result.createdAt.toISOString(),
        publicKey: result.publicKey,
        secretKey: result.secretKey,
        displaySecretKey: result.displaySecretKey,
        note: result.note,
      });
    }
  } catch (e) {
    logger.error("Failed to process organization API key request", e);
    res.status(500).json({ error: "Internal server error" });
  }
}
