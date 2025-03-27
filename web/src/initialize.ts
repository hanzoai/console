import { env } from "@/src/env.mjs";
import { createUserEmailPassword } from "@/src/features/auth-credentials/lib/credentialsServerUtils";
import { prisma } from "@hanzo/shared/src/db";
import { createAndAddApiKeysToDb } from "@hanzo/shared/src/server/auth/apiKeys";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";
import { getOrganizationPlanServerSide } from "@/src/features/entitlements/server/getPlan";

// Create Organization
if (env.HANZO_INIT_ORG_ID) {
  const org = await prisma.organization.upsert({
    where: { id: env.HANZO_INIT_ORG_ID },
    update: {},
    create: {
      id: env.HANZO_INIT_ORG_ID,
      name: env.HANZO_INIT_ORG_NAME ?? "Provisioned Org",
    },
  });

  // Create Project: Org -> Project
  if (env.HANZO_INIT_PROJECT_ID) {
    let retentionDays: number | null = null;
    const hasRetentionEntitlement = hasEntitlementBasedOnPlan({
      plan: getOrganizationPlanServerSide(),
      entitlement: "data-retention",
    });
    if (env.HANZO_INIT_PROJECT_RETENTION && hasRetentionEntitlement) {
      retentionDays = env.HANZO_INIT_PROJECT_RETENTION;
    }

    await prisma.project.upsert({
      where: { id: env.HANZO_INIT_PROJECT_ID },
      update: {},
      create: {
        id: env.HANZO_INIT_PROJECT_ID,
        name: env.HANZO_INIT_PROJECT_NAME ?? "Provisioned Project",
        orgId: org.id,
        retentionDays,
      },
    });

    // Add API Keys: Project -> API Key
    if (
      env.HANZO_INIT_PROJECT_SECRET_KEY &&
      env.HANZO_INIT_PROJECT_PUBLIC_KEY
    ) {
      const existingApiKey = await prisma.apiKey.findUnique({
        where: { publicKey: env.HANZO_INIT_PROJECT_PUBLIC_KEY },
      });

      // Delete key if project changed
      if (
        existingApiKey &&
        existingApiKey.projectId !== env.HANZO_INIT_PROJECT_ID
      ) {
        await prisma.apiKey.delete({
          where: { publicKey: env.HANZO_INIT_PROJECT_PUBLIC_KEY },
        });
      }

      // Create new key if it doesn't exist or project changed
      if (
        !existingApiKey ||
        existingApiKey.projectId !== env.HANZO_INIT_PROJECT_ID
      ) {
        await createAndAddApiKeysToDb({
          prisma,
          projectId: env.HANZO_INIT_PROJECT_ID,
          note: "Provisioned API Key",
          predefinedKeys: {
            secretKey: env.HANZO_INIT_PROJECT_SECRET_KEY,
            publicKey: env.HANZO_INIT_PROJECT_PUBLIC_KEY,
          },
        });
      }
    }
  }

  // Create User: Org -> User
  if (env.HANZO_INIT_USER_EMAIL && env.HANZO_INIT_USER_PASSWORD) {
    const email = env.HANZO_INIT_USER_EMAIL.toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    let userId = existingUser?.id;

    // Create user if it doesn't exist yet
    if (!userId) {
      userId = await createUserEmailPassword(
        email,
        env.HANZO_INIT_USER_PASSWORD,
        env.HANZO_INIT_USER_NAME ?? "Provisioned User",
      );
    }

    // Create OrgMembership: Org -> OrgMembership <- User
    await prisma.organizationMembership.upsert({
      where: {
        orgId_userId: { userId, orgId: org.id },
      },
      update: { role: "OWNER" },
      create: {
        userId,
        orgId: org.id,
        role: "OWNER",
      },
    });
  }
}
