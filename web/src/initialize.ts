import { env } from "@/src/env.mjs";
import { createUserEmailPassword } from "@/src/features/auth-credentials/lib/credentialsServerUtils";
import { prisma } from "@hanzo/shared/src/db";
import { createAndAddApiKeysToDb } from "@hanzo/shared/src/server/auth/apiKeys";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";
import { getOrganizationPlanServerSide } from "@/src/features/entitlements/server/getPlan";
import { CloudConfigSchema } from "@hanzo/shared";
import { logger } from "@hanzo/shared/src/server";

// Warn if HANZO_INIT_* variables are set but HANZO_INIT_ORG_ID is missing
if (!env.HANZO_INIT_ORG_ID) {
  const setInitVars = [
    env.HANZO_INIT_ORG_NAME && "HANZO_INIT_ORG_NAME",
    env.HANZO_INIT_ORG_CLOUD_PLAN && "HANZO_INIT_ORG_CLOUD_PLAN",
    env.HANZO_INIT_PROJECT_ID && "HANZO_INIT_PROJECT_ID",
    env.HANZO_INIT_PROJECT_NAME && "HANZO_INIT_PROJECT_NAME",
    env.HANZO_INIT_PROJECT_RETENTION && "HANZO_INIT_PROJECT_RETENTION",
    env.HANZO_INIT_PROJECT_PUBLIC_KEY && "HANZO_INIT_PROJECT_PUBLIC_KEY",
    env.HANZO_INIT_PROJECT_SECRET_KEY && "HANZO_INIT_PROJECT_SECRET_KEY",
    env.HANZO_INIT_USER_EMAIL && "HANZO_INIT_USER_EMAIL",
    env.HANZO_INIT_USER_NAME && "HANZO_INIT_USER_NAME",
    env.HANZO_INIT_USER_PASSWORD && "HANZO_INIT_USER_PASSWORD",
  ].filter(Boolean) as string[];

  if (setInitVars.length > 0) {
    logger.warn(
      `[Hanzo Init] HANZO_INIT_ORG_ID is not set but other HANZO_INIT_* variables are configured. ` +
        `The following variables will be ignored: ${setInitVars.join(", ")}. ` +
        `Set HANZO_INIT_ORG_ID to enable initialization.`,
    );
  }
}

// Create Organization
if (env.HANZO_INIT_ORG_ID) {
  const cloudConfig = env.HANZO_INIT_ORG_CLOUD_PLAN
    ? CloudConfigSchema.parse({
        plan: env.HANZO_INIT_ORG_CLOUD_PLAN,
      })
    : undefined;

  const org = await prisma.organization.upsert({
    where: { id: env.HANZO_INIT_ORG_ID },
    update: {},
    create: {
      id: env.HANZO_INIT_ORG_ID,
      name: env.HANZO_INIT_ORG_NAME ?? "Provisioned Org",
      cloudConfig,
    },
  });

  // Warn about partial configurations
  const hasPublicKey = Boolean(env.HANZO_INIT_PROJECT_PUBLIC_KEY);
  const hasSecretKey = Boolean(env.HANZO_INIT_PROJECT_SECRET_KEY);
  const hasEmail = Boolean(env.HANZO_INIT_USER_EMAIL);
  const hasPassword = Boolean(env.HANZO_INIT_USER_PASSWORD);

  // Partial API key config
  if (hasPublicKey !== hasSecretKey) {
    const missingKey = hasPublicKey ? "HANZO_INIT_PROJECT_SECRET_KEY" : "HANZO_INIT_PROJECT_PUBLIC_KEY";
    logger.warn(
      `[Hanzo Init] Partial API key configuration: ${missingKey} is not set. ` +
        `Both HANZO_INIT_PROJECT_PUBLIC_KEY and HANZO_INIT_PROJECT_SECRET_KEY must be set to create API keys.`,
    );
  }

  // API keys without project ID
  if ((hasPublicKey || hasSecretKey) && !env.HANZO_INIT_PROJECT_ID) {
    logger.warn(
      `[Hanzo Init] HANZO_INIT_PROJECT_ID is not set but API key variables are configured. ` +
        `API keys will not be created. Set HANZO_INIT_PROJECT_ID to enable API key creation.`,
    );
  }

  // Partial user config
  if (hasEmail !== hasPassword) {
    const missingVar = hasEmail ? "HANZO_INIT_USER_PASSWORD" : "HANZO_INIT_USER_EMAIL";
    logger.warn(
      `[Hanzo Init] Partial user configuration: ${missingVar} is not set. ` +
        `Both HANZO_INIT_USER_EMAIL and HANZO_INIT_USER_PASSWORD must be set to create a user.`,
    );
  }

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
    if (env.HANZO_INIT_PROJECT_SECRET_KEY && env.HANZO_INIT_PROJECT_PUBLIC_KEY) {
      const existingApiKey = await prisma.apiKey.findUnique({
        where: { publicKey: env.HANZO_INIT_PROJECT_PUBLIC_KEY },
      });

      // Delete key if project changed
      if (existingApiKey && existingApiKey.projectId !== env.HANZO_INIT_PROJECT_ID) {
        await prisma.apiKey.delete({
          where: { publicKey: env.HANZO_INIT_PROJECT_PUBLIC_KEY },
        });
      }

      // Create new key if it doesn't exist or project changed
      if (!existingApiKey || existingApiKey.projectId !== env.HANZO_INIT_PROJECT_ID) {
        await createAndAddApiKeysToDb({
          prisma,
          entityId: env.HANZO_INIT_PROJECT_ID,
          note: "Provisioned API Key",
          scope: "PROJECT",
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
