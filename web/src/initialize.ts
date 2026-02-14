import { env } from "@/src/env.mjs";
import { createUserEmailPassword } from "@/src/features/auth-credentials/lib/credentialsServerUtils";
import { prisma } from "@hanzo/shared/src/db";
import { createAndAddApiKeysToDb } from "@hanzo/shared/src/server/auth/apiKeys";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";
import { getOrganizationPlanServerSide } from "@/src/features/entitlements/server/getPlan";
import { CloudConfigSchema } from "@hanzo/shared";
import { logger } from "@hanzo/shared/src/server";

const toTitleCase = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");

const multiOrgIds = env.HANZO_INIT_ORG_IDS ?? [];
const multiOrgNames = env.HANZO_INIT_ORG_NAMES ?? [];

if (multiOrgNames.length > 0 && multiOrgIds.length === 0) {
  logger.warn(
    "[Hanzo Init] HANZO_INIT_ORG_NAMES is set but HANZO_INIT_ORG_IDS is empty. " +
      "Organization names from HANZO_INIT_ORG_NAMES will be ignored.",
  );
}

if (multiOrgNames.length > 0 && multiOrgNames.length !== multiOrgIds.length) {
  logger.warn(
    "[Hanzo Init] HANZO_INIT_ORG_NAMES count does not match HANZO_INIT_ORG_IDS count. " +
      "Missing names will default to a title-cased organization ID.",
  );
}

const initOrgsById = new Map<string, { id: string; name: string }>();

const addInitOrg = (id?: string, name?: string) => {
  if (!id) return;
  const cleanId = id.trim();
  if (!cleanId) return;
  const cleanName = name?.trim() || toTitleCase(cleanId);
  if (!initOrgsById.has(cleanId)) {
    initOrgsById.set(cleanId, { id: cleanId, name: cleanName });
  }
};

addInitOrg(env.HANZO_INIT_ORG_ID, env.HANZO_INIT_ORG_NAME ?? undefined);
for (let i = 0; i < multiOrgIds.length; i++) {
  addInitOrg(multiOrgIds[i], multiOrgNames[i]);
}

const initOrganizations = Array.from(initOrgsById.values());

// Warn if HANZO_INIT_* variables are set but no init organizations are configured
if (initOrganizations.length === 0) {
  const setInitVars = [
    multiOrgIds.length > 0 && "HANZO_INIT_ORG_IDS",
    env.HANZO_INIT_ORG_NAME && "HANZO_INIT_ORG_NAME",
    multiOrgNames.length > 0 && "HANZO_INIT_ORG_NAMES",
    env.HANZO_INIT_ORG_CLOUD_PLAN && "HANZO_INIT_ORG_CLOUD_PLAN",
    env.HANZO_INIT_PROJECT_ID && "HANZO_INIT_PROJECT_ID",
    env.HANZO_INIT_PROJECT_ORG_ID && "HANZO_INIT_PROJECT_ORG_ID",
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
      `[Hanzo Init] No init organizations are configured (set HANZO_INIT_ORG_ID or HANZO_INIT_ORG_IDS). ` +
        `The following variables will be ignored: ${setInitVars.join(", ")}. ` +
        `Set HANZO_INIT_ORG_ID or HANZO_INIT_ORG_IDS to enable initialization.`,
    );
  }
}

if (initOrganizations.length > 0) {
  const cloudConfig = env.HANZO_INIT_ORG_CLOUD_PLAN
    ? CloudConfigSchema.parse({
        plan: env.HANZO_INIT_ORG_CLOUD_PLAN,
      })
    : undefined;

  const orgIds = new Set<string>();
  for (const initOrg of initOrganizations) {
    const org = await prisma.organization.upsert({
      where: { id: initOrg.id },
      update: {},
      create: {
        id: initOrg.id,
        name: initOrg.name,
        cloudConfig,
      },
    });
    orgIds.add(org.id);
  }

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

  const projectOrgId =
    env.HANZO_INIT_PROJECT_ORG_ID ??
    env.HANZO_INIT_ORG_ID ??
    (initOrganizations.length === 1 ? initOrganizations[0]?.id : undefined);

  if (env.HANZO_INIT_PROJECT_ID && !projectOrgId) {
    logger.warn(
      `[Hanzo Init] HANZO_INIT_PROJECT_ID is set but target organization is ambiguous. ` +
        `Set HANZO_INIT_PROJECT_ORG_ID when initializing multiple organizations.`,
    );
  }

  if (projectOrgId && !orgIds.has(projectOrgId)) {
    logger.warn(
      `[Hanzo Init] HANZO_INIT_PROJECT_ORG_ID is set to "${projectOrgId}" but that org is not initialized. ` +
        `Project/API key initialization will be skipped.`,
    );
  }

  // Partial user config
  if (!hasEmail && hasPassword) {
    const missingVar = "HANZO_INIT_USER_EMAIL";
    logger.warn(
      `[Hanzo Init] Partial user configuration: ${missingVar} is not set. ` +
        `Set HANZO_INIT_USER_EMAIL to attach organization memberships.`,
    );
  }

  // Create Project: Org -> Project
  if (env.HANZO_INIT_PROJECT_ID && projectOrgId && orgIds.has(projectOrgId)) {
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
        orgId: projectOrgId,
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
  if (env.HANZO_INIT_USER_EMAIL) {
    const email = env.HANZO_INIT_USER_EMAIL.toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    let userId = existingUser?.id;

    // Create user if it doesn't exist yet
    if (!userId && env.HANZO_INIT_USER_PASSWORD) {
      userId = await createUserEmailPassword(
        email,
        env.HANZO_INIT_USER_PASSWORD,
        env.HANZO_INIT_USER_NAME ?? "Provisioned User",
      );
    }

    if (!userId) {
      logger.warn(
        `[Hanzo Init] HANZO_INIT_USER_EMAIL is set to "${email}" but no matching user exists and ` +
          `HANZO_INIT_USER_PASSWORD is not set. Skipping membership bootstrap for initialized orgs.`,
      );
    } else {
      // Create OrgMembership: Org -> OrgMembership <- User for all initialized organizations
      for (const orgId of orgIds) {
        await prisma.organizationMembership.upsert({
          where: {
            orgId_userId: { userId, orgId },
          },
          update: { role: "OWNER" },
          create: {
            userId,
            orgId,
            role: "OWNER",
          },
        });
      }
    }
  }
}
