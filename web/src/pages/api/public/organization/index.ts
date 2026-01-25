import { getOrganizationPlanServerSide } from "@/src/features/entitlements/server/getPlan";
import { CloudConfigSchema } from "@langfuse/shared";
import { prisma } from "@langfuse/shared/src/db";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const email = req.query.email as string;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        admin: true,
        emailVerified: true,
        featureFlags: true,
        organizationMemberships: {
          include: {
            organization: {
              include: {
                projects: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const organizations = user.organizationMemberships.map((membership) => {
      const parsedCloudConfig = CloudConfigSchema.safeParse(
        membership.organization.cloudConfig,
      );

      return {
        id: membership.organization.id,
        name: membership.organization.name,
        role: membership.role,
        projects: membership.organization.projects.map((project) => ({
          id: project.id,
          name: project.name,
          role: membership.role,
          deletedAt: project.deletedAt,
          retentionDays: project.retentionDays,
        })),
        plan: getOrganizationPlanServerSide(parsedCloudConfig.data),
      };
    });

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        admin: user.admin,
        emailVerified: user.emailVerified?.toISOString(),
        canCreateOrganizations: true, // Optional: update logic if needed
        organizations,
        featureFlags: user.featureFlags,
      },
    });
  } catch (error) {
    console.error("Error fetching user organizations:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
