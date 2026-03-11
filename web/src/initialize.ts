import { env } from "@/src/env.mjs";
import { createUserEmailPassword } from "@/src/features/auth-credentials/lib/credentialsServerUtils";
import { prisma } from "@hanzo/console-core/src/db";
import { createAndAddApiKeysToDb } from "@hanzo/console-core/src/server/auth/apiKeys";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";
import { getOrganizationPlanServerSide } from "@/src/features/entitlements/server/getPlan";
import { CloudConfigSchema } from "@hanzo/console";
import { logger } from "@hanzo/console-core/src/server";

const toTitleCase = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");

const multiOrgIds = env.INIT_ORG_IDS ?? [];
const multiOrgNames = env.INIT_ORG_NAMES ?? [];

if (multiOrgNames.length > 0 && multiOrgIds.length === 0) {
  logger.warn(
    "[Hanzo Init] INIT_ORG_NAMES is set but INIT_ORG_IDS is empty. " +
      "Organization names from INIT_ORG_NAMES will be ignored.",
  );
}

if (multiOrgNames.length > 0 && multiOrgNames.length !== multiOrgIds.length) {
  logger.warn(
    "[Hanzo Init] INIT_ORG_NAMES count does not match INIT_ORG_IDS count. " +
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

addInitOrg(env.INIT_ORG_ID, env.INIT_ORG_NAME ?? undefined);
for (let i = 0; i < multiOrgIds.length; i++) {
  addInitOrg(multiOrgIds[i], multiOrgNames[i]);
}

const initOrganizations = Array.from(initOrgsById.values());

// Warn if INIT_* variables are set but no init organizations are configured
if (initOrganizations.length === 0) {
  const setInitVars = [
    multiOrgIds.length > 0 && "INIT_ORG_IDS",
    env.INIT_ORG_NAME && "INIT_ORG_NAME",
    multiOrgNames.length > 0 && "INIT_ORG_NAMES",
    env.INIT_ORG_CLOUD_PLAN && "INIT_ORG_CLOUD_PLAN",
    env.INIT_PROJECT_ID && "INIT_PROJECT_ID",
    env.INIT_PROJECT_ORG_ID && "INIT_PROJECT_ORG_ID",
    env.INIT_PROJECT_NAME && "INIT_PROJECT_NAME",
    env.INIT_PROJECT_RETENTION && "INIT_PROJECT_RETENTION",
    env.INIT_PROJECT_PUBLIC_KEY && "INIT_PROJECT_PUBLIC_KEY",
    env.INIT_PROJECT_SECRET_KEY && "INIT_PROJECT_SECRET_KEY",
    env.INIT_USER_EMAIL && "INIT_USER_EMAIL",
    env.INIT_USER_NAME && "INIT_USER_NAME",
    env.INIT_USER_PASSWORD && "INIT_USER_PASSWORD",
  ].filter(Boolean) as string[];

  if (setInitVars.length > 0) {
    logger.warn(
      `[Hanzo Init] No init organizations are configured (set INIT_ORG_ID or INIT_ORG_IDS). ` +
        `The following variables will be ignored: ${setInitVars.join(", ")}. ` +
        `Set INIT_ORG_ID or INIT_ORG_IDS to enable initialization.`,
    );
  }
}

if (initOrganizations.length > 0) {
  const cloudConfig = env.INIT_ORG_CLOUD_PLAN
    ? CloudConfigSchema.parse({
        plan: env.INIT_ORG_CLOUD_PLAN,
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
  const hasPublicKey = Boolean(env.INIT_PROJECT_PUBLIC_KEY);
  const hasSecretKey = Boolean(env.INIT_PROJECT_SECRET_KEY);
  const hasEmail = Boolean(env.INIT_USER_EMAIL);
  const hasPassword = Boolean(env.INIT_USER_PASSWORD);

  // Partial API key config
  if (hasPublicKey !== hasSecretKey) {
    const missingKey = hasPublicKey ? "INIT_PROJECT_SECRET_KEY" : "INIT_PROJECT_PUBLIC_KEY";
    logger.warn(
      `[Hanzo Init] Partial API key configuration: ${missingKey} is not set. ` +
        `Both INIT_PROJECT_PUBLIC_KEY and INIT_PROJECT_SECRET_KEY must be set to create API keys.`,
    );
  }

  // API keys without project ID
  if ((hasPublicKey || hasSecretKey) && !env.INIT_PROJECT_ID) {
    logger.warn(
      `[Hanzo Init] INIT_PROJECT_ID is not set but API key variables are configured. ` +
        `API keys will not be created. Set INIT_PROJECT_ID to enable API key creation.`,
    );
  }

  const projectOrgId =
    env.INIT_PROJECT_ORG_ID ??
    env.INIT_ORG_ID ??
    (initOrganizations.length === 1 ? initOrganizations[0]?.id : undefined);

  if (env.INIT_PROJECT_ID && !projectOrgId) {
    logger.warn(
      `[Hanzo Init] INIT_PROJECT_ID is set but target organization is ambiguous. ` +
        `Set INIT_PROJECT_ORG_ID when initializing multiple organizations.`,
    );
  }

  if (projectOrgId && !orgIds.has(projectOrgId)) {
    logger.warn(
      `[Hanzo Init] INIT_PROJECT_ORG_ID is set to "${projectOrgId}" but that org is not initialized. ` +
        `Project/API key initialization will be skipped.`,
    );
  }

  // Partial user config
  if (!hasEmail && hasPassword) {
    const missingVar = "INIT_USER_EMAIL";
    logger.warn(
      `[Hanzo Init] Partial user configuration: ${missingVar} is not set. ` +
        `Set INIT_USER_EMAIL to attach organization memberships.`,
    );
  }

  // Create Project: Org -> Project
  if (env.INIT_PROJECT_ID && projectOrgId && orgIds.has(projectOrgId)) {
    let retentionDays: number | null = null;
    const hasRetentionEntitlement = hasEntitlementBasedOnPlan({
      plan: getOrganizationPlanServerSide(),
      entitlement: "data-retention",
    });
    if (env.INIT_PROJECT_RETENTION && hasRetentionEntitlement) {
      retentionDays = env.INIT_PROJECT_RETENTION;
    }

    await prisma.project.upsert({
      where: { id: env.INIT_PROJECT_ID },
      update: {},
      create: {
        id: env.INIT_PROJECT_ID,
        name: env.INIT_PROJECT_NAME ?? "Provisioned Project",
        orgId: projectOrgId,
        retentionDays,
      },
    });

    // Add API Keys: Project -> API Key
    if (env.INIT_PROJECT_SECRET_KEY && env.INIT_PROJECT_PUBLIC_KEY) {
      const existingApiKey = await prisma.apiKey.findUnique({
        where: { publicKey: env.INIT_PROJECT_PUBLIC_KEY },
      });

      // Delete key if project changed
      if (existingApiKey && existingApiKey.projectId !== env.INIT_PROJECT_ID) {
        await prisma.apiKey.delete({
          where: { publicKey: env.INIT_PROJECT_PUBLIC_KEY },
        });
      }

      // Create new key if it doesn't exist or project changed
      if (!existingApiKey || existingApiKey.projectId !== env.INIT_PROJECT_ID) {
        await createAndAddApiKeysToDb({
          prisma,
          entityId: env.INIT_PROJECT_ID,
          note: "Provisioned API Key",
          scope: "PROJECT",
          predefinedKeys: {
            secretKey: env.INIT_PROJECT_SECRET_KEY,
            publicKey: env.INIT_PROJECT_PUBLIC_KEY,
          },
        });
      }
    }
  }

  // Helper to grant OWNER membership for an email across a set of org IDs
  const grantOwner = async (email: string, targetOrgIds: Iterable<string>) => {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser) {
      logger.warn(
        `[Hanzo Init] User "${email}" not found in DB — skipping org membership grant. ` +
          `They will be granted OWNER on next startup after first login.`,
      );
      return;
    }
    for (const orgId of targetOrgIds) {
      if (!orgIds.has(orgId)) continue;
      await prisma.organizationMembership.upsert({
        where: { orgId_userId: { userId: existingUser.id, orgId } },
        update: { role: "OWNER" },
        create: { userId: existingUser.id, orgId, role: "OWNER" },
      });
    }
  };

  // INIT_USER_EMAIL → OWNER of all initialized orgs
  if (env.INIT_USER_EMAIL) {
    const email = env.INIT_USER_EMAIL.toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email } });
    let userId = existingUser?.id;

    if (!userId && env.INIT_USER_PASSWORD) {
      userId = await createUserEmailPassword(email, env.INIT_USER_PASSWORD, env.INIT_USER_NAME ?? "Provisioned User");
    }

    if (!userId) {
      logger.warn(
        `[Hanzo Init] INIT_USER_EMAIL is set to "${email}" but no matching user exists and ` +
          `INIT_USER_PASSWORD is not set. Skipping membership bootstrap for initialized orgs.`,
      );
    } else {
      for (const orgId of orgIds) {
        await prisma.organizationMembership.upsert({
          where: { orgId_userId: { userId, orgId } },
          update: { role: "OWNER" },
          create: { userId, orgId, role: "OWNER" },
        });
      }
    }
  }

  // INIT_ORG_OWNERS → scoped per-email OWNER grants ("email:orgId" or "email:*")
  if (env.INIT_ORG_OWNERS) {
    for (const { email, orgId } of env.INIT_ORG_OWNERS) {
      const normalizedEmail = email.toLowerCase();
      if (orgId === "*") {
        await grantOwner(normalizedEmail, orgIds);
      } else {
        await grantOwner(normalizedEmail, [orgId]);
      }
    }
  }
}
