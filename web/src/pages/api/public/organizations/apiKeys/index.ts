import { ApiAuthService } from "@/src/features/public-api/server/apiAuth";
import { cors, runMiddleware } from "@/src/features/public-api/server/cors";
import { prisma } from "@hanzo/shared/src/db";
import { logger, redis } from "@hanzo/shared/src/server";
import { type NextApiRequest, type NextApiResponse } from "next";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, cors);

  if (req.method !== "GET") {
    logger.error(`Method not allowed for ${req.method} on /api/public/organizations/apiKeys`);
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  // CHECK AUTH
  const authCheck = await new ApiAuthService(prisma, redis).verifyAuthHeaderAndReturnScope(req.headers.authorization);
  if (!authCheck.validKey) {
    return res.status(401).json({
      error: authCheck.error,
    });
  }
  // END CHECK AUTH

  // Check if using an organization API key
  if (authCheck.scope.accessLevel !== "organization" || !authCheck.scope.orgId) {
    return res.status(403).json({
      error: "Invalid API key. Organization-scoped API key required for this operation.",
    });
  }

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

  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        orgId: authCheck.scope.orgId,
      },
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
  } catch (error) {
    logger.error(`Error handling organization API keys for ${req.method}`, error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
