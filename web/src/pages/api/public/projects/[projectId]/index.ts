import { ApiAuthService } from "@/src/features/public-api/server/apiAuth";
import { cors, runMiddleware } from "@/src/features/public-api/server/cors";
import { prisma } from "@hanzo/shared/src/db";
import { logger, redis } from "@hanzo/shared/src/server";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";
import { type NextApiRequest, type NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, cors);

  const { projectId } = req.query;

  if (typeof projectId !== "string") {
    return res.status(400).json({ message: "Invalid project ID" });
  }

  if (req.method !== "DELETE" && req.method !== "PUT") {
    logger.error(`Method not allowed for ${req.method} on /api/public/projects/${projectId}`);
    return res.status(405).json({ message: "Method not allowed" });
  }

  // CHECK AUTH
  const authCheck = await new ApiAuthService(prisma, redis).verifyAuthHeaderAndReturnScope(req.headers.authorization);
  if (!authCheck.validKey) {
    return res.status(401).json({
      message: authCheck.error,
    });
  }

  // Check if using an organization API key
  if (authCheck.scope.accessLevel !== "organization" || !authCheck.scope.orgId) {
    return res.status(403).json({
      message: "Invalid API key. Organization-scoped API key required for this operation.",
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

  // Check if project exists and belongs to the organization
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

  try {
    if (req.method === "PUT") {
      const { name, metadata, retention } = req.body ?? {};

      // Validate name if provided
      if (name !== undefined && (typeof name !== "string" || name.length < 3 || name.length > 60)) {
        return res.status(400).json({
          message: "Invalid project name. Name must be between 3 and 60 characters.",
        });
      }

      // Validate retention if provided
      if (retention !== undefined && retention !== null) {
        if (typeof retention !== "number" || (retention !== 0 && retention < 3)) {
          return res.status(400).json({
            message: "Invalid retention value. Must be 0 or >= 3.",
          });
        }
      }

      const updated = await prisma.project.update({
        where: { id: projectId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(metadata !== undefined ? { metadata } : {}),
          ...(retention !== undefined ? { retentionDays: retention } : {}),
        },
      });

      return res.status(200).json({
        id: updated.id,
        name: updated.name,
        metadata: updated.metadata ?? {},
        ...(updated.retentionDays ? { retentionDays: updated.retentionDays } : {}),
      });
    }

    if (req.method === "DELETE") {
      // Soft delete
      await prisma.project.update({
        where: { id: projectId },
        data: { deletedAt: new Date() },
      });

      return res.status(202).json({
        success: true,
        message: "Project deletion is being processed asynchronously.",
      });
    }
  } catch (error) {
    logger.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
