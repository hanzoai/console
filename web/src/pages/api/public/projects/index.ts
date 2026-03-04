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

  if (req.method !== "GET" && req.method !== "POST") {
    logger.error(
      `Method not allowed for ${req.method} on /api/public/projects`,
    );
    return res.status(405).json({ message: "Method not allowed" });
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
  // END CHECK AUTH

  if (req.method === "GET") {
    if (
      authCheck.scope.accessLevel !== "project" ||
      !authCheck.scope.projectId
    ) {
      return res.status(403).json({
        message: "Invalid API key. Are you using an organization key?",
      });
    }

    try {
      const projects = await prisma.project.findMany({
        select: {
          id: true,
          name: true,
          retentionDays: true,
          metadata: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        where: {
          id: authCheck.scope.projectId,
          deletedAt: null,
        },
      });

      return res.status(200).json({
        data: projects.map((project) => ({
          id: project.id,
          name: project.name,
          organization: {
            id: project.organization.id,
            name: project.organization.name,
          },
          metadata: project.metadata ?? {},
          ...(project.retentionDays
            ? { retentionDays: project.retentionDays }
            : {}),
        })),
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  if (req.method === "POST") {
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
      const { name, metadata, retention } = req.body ?? {};

      // Validate name
      if (
        !name ||
        typeof name !== "string" ||
        name.length < 3 ||
        name.length > 60
      ) {
        return res.status(400).json({
          message:
            "Invalid project name. Name must be between 3 and 60 characters.",
        });
      }

      // Validate retention
      if (retention !== undefined && retention !== null) {
        if (
          typeof retention !== "number" ||
          (retention !== 0 && retention < 3)
        ) {
          return res.status(400).json({
            message: "Invalid retention value. Must be 0 or >= 3.",
          });
        }
      }

      // Check for duplicate name in organization
      const existing = await prisma.project.findFirst({
        where: {
          name,
          orgId: authCheck.scope.orgId,
          deletedAt: null,
        },
      });

      if (existing) {
        return res.status(409).json({
          message: `Project with name "${name}" already exists in this organization.`,
        });
      }

      const project = await prisma.project.create({
        data: {
          name,
          orgId: authCheck.scope.orgId,
          metadata: metadata ?? undefined,
          retentionDays: retention ?? null,
        },
      });

      return res.status(201).json({
        id: project.id,
        name: project.name,
        metadata: project.metadata ?? {},
        ...(project.retentionDays
          ? { retentionDays: project.retentionDays }
          : {}),
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}
