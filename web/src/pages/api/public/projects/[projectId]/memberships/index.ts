import { ApiAuthService } from "@/src/features/public-api/server/apiAuth";
import { cors, runMiddleware } from "@/src/features/public-api/server/cors";
import { prisma } from "@hanzo/console-core/src/db";
import { logger, redis } from "@hanzo/console-core/src/server";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";

import { type NextApiRequest, type NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, cors);

  if (!["GET", "PUT", "DELETE"].includes(req.method || "")) {
    logger.error(`Method not allowed for ${req.method} on /api/public/projects/[projectId]/memberships`);
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const { projectId } = req.query;
  if (!projectId || typeof projectId !== "string") {
    return res.status(400).json({
      error: "projectId is required",
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

  // Check if organization has the rbac-project-roles entitlement
  if (
    !hasEntitlementBasedOnPlan({
      plan: authCheck.scope.plan,
      entitlement: "rbac-project-roles",
    })
  ) {
    return res.status(403).json({
      error: "Your plan does not include project role management.",
    });
  }

  // Check for admin-api entitlement
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

  // Verify the project belongs to the organization
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      orgId,
      deletedAt: null,
    },
  });

  if (!project) {
    return res.status(404).json({
      error: "Project not found or does not belong to this organization",
    });
  }

  try {
    if (req.method === "GET") {
      const memberships = await prisma.projectMembership.findMany({
        where: { projectId },
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

      // Verify user has an organization membership
      const orgMembership = await prisma.organizationMembership.findUnique({
        where: {
          orgId_userId: { orgId, userId },
        },
      });

      if (!orgMembership) {
        return res.status(404).json({
          error: "User is not a member of the organization",
        });
      }

      const membership = await prisma.projectMembership.upsert({
        where: {
          projectId_userId: { projectId, userId },
        },
        update: { role },
        create: {
          projectId,
          userId,
          role,
          orgMembershipId: orgMembership.id,
        },
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

      await prisma.projectMembership.delete({
        where: {
          projectId_userId: { projectId, userId },
        },
      });

      return res.status(200).json({
        message: "Project membership deleted successfully",
        userId,
      });
    }
  } catch (error) {
    logger.error(`Error handling project memberships for ${req.method} on project ${projectId}`, error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
