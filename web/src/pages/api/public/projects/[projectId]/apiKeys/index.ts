import { type NextApiRequest, type NextApiResponse } from "next";
import { prisma } from "@hanzo/shared/src/db";
import {
  logger,
  redis,
  createAndAddApiKeysToDb,
} from "@hanzo/shared/src/server";
import { ApiAuthService } from "@/src/features/public-api/server/apiAuth";
import { cors, runMiddleware } from "@/src/features/public-api/server/cors";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await runMiddleware(req, res, cors);

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).json({ message: "Method Not Allowed" });
      return;
    }

    // CHECK AUTH
    const authCheck = await new ApiAuthService(
      prisma,
      redis,
    ).verifyAuthHeaderAndReturnScope(req.headers.authorization);
    if (!authCheck.validKey) {
      return res.status(401).json({
        message: authCheck.error,
      });
    }

    // Check if using an organization API key
    if (
      authCheck.scope.accessLevel !== "organization" ||
      !authCheck.scope.orgId
    ) {
      return res.status(403).json({
        message:
          "Invalid API key. Organization-scoped API key required for this operation.",
      });
    }
    // END CHECK AUTH

    if (
      !hasEntitlementBasedOnPlan({
        plan: authCheck.scope.plan,
        entitlement: "admin-api",
      })
    ) {
      return res.status(403).json({
        error: "This feature is not available on your current plan.",
      });
    }

    const { projectId } = req.query;
    if (!projectId || typeof projectId !== "string") {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // Verify project exists and belongs to the organization
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: authCheck.scope.orgId,
        deletedAt: null,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found or you don't have access to it",
      });
    }

    if (req.method === "GET") {
      const apiKeys = await prisma.apiKey.findMany({
        where: { projectId },
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
      const {
        note,
        publicKey: predefinedPk,
        secretKey: predefinedSk,
      } = req.body ?? {};

      // Validate predefined keys
      if ((predefinedPk && !predefinedSk) || (!predefinedPk && predefinedSk)) {
        return res.status(400).json({
          message:
            "Both publicKey and secretKey must be provided together, or neither.",
        });
      }

      if (predefinedPk && !predefinedPk.startsWith("pk-hz-")) {
        return res.status(400).json({
          message: "publicKey must start with 'pk-hz-'",
        });
      }

      if (predefinedSk && !predefinedSk.startsWith("sk-hz-")) {
        return res.status(400).json({
          message: "secretKey must start with 'sk-hz-'",
        });
      }

      // Check for duplicate publicKey
      if (predefinedPk) {
        const existing = await prisma.apiKey.findFirst({
          where: { publicKey: predefinedPk },
        });
        if (existing) {
          return res.status(409).json({
            message: "An API key with this publicKey already exists.",
          });
        }
      }

      const result = await createAndAddApiKeysToDb({
        prisma,
        entityId: projectId,
        scope: "PROJECT",
        note: note ?? null,
        ...(predefinedPk && predefinedSk
          ? {
              predefinedKeys: {
                publicKey: predefinedPk,
                secretKey: predefinedSk,
              },
            }
          : {}),
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
    logger.error("Failed to process project API key request", e);
    res.status(500).json({ message: "Internal server error" });
  }
}
