import { ApiAuthService } from "@/src/features/public-api/server/apiAuth";
import { cors, runMiddleware } from "@/src/features/public-api/server/cors";
import { prisma } from "@hanzo/shared/src/db";
import { logger, redis } from "@hanzo/shared/src/server";
import { type NextApiRequest, type NextApiResponse } from "next";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await runMiddleware(req, res, cors);

  if (!["GET", "PUT", "DELETE"].includes(req.method || "")) {
    logger.error(
      `Method not allowed for ${req.method} on /api/public/organizations/memberships`,
    );
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  // CHECK AUTH
  const authCheck = await new ApiAuthService(
    prisma,
    redis,
  ).verifyAuthHeaderAndReturnScope(req.headers.authorization);
  if (!authCheck.validKey) {
    return res.status(401).json({
      error: authCheck.error,
    });
  }
  // END CHECK AUTH

  // Check if using an organization API key
  if (
    authCheck.scope.accessLevel !== "organization" ||
    !authCheck.scope.orgId
  ) {
    return res.status(403).json({
      error:
        "Invalid API key. Organization-scoped API key required for this operation.",
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

  const orgId = authCheck.scope.orgId;

  try {
    if (req.method === "GET") {
      const memberships = await prisma.organizationMembership.findMany({
        where: { orgId },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      return res.status(200).json({
        memberships: memberships.map((m) => ({
          userId: m.userId,
          role: m.role,
          email: m.user.email!,
          name: m.user.name,
        })),
      });
    }

    if (req.method === "PUT") {
      const { userId, role } = req.body ?? {};

      if (!userId || !role) {
        return res.status(400).json({ error: "userId and role are required" });
      }

      // Verify user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const membership = await prisma.organizationMembership.upsert({
        where: {
          orgId_userId: { orgId, userId },
        },
        update: { role },
        create: { orgId, userId, role },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      return res.status(200).json({
        userId: membership.userId,
        role: membership.role,
        email: membership.user.email!,
        name: membership.user.name,
      });
    }

    if (req.method === "DELETE") {
      const { userId } = req.body ?? {};

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      await prisma.organizationMembership.delete({
        where: {
          orgId_userId: { orgId, userId },
        },
      });

      return res.status(200).json({
        message: "Membership deleted successfully",
        userId,
      });
    }
  } catch (error) {
    logger.error(
      `Error handling organization memberships for ${req.method}`,
      error,
    );
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
