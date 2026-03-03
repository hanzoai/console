import { env } from "@/src/env.mjs";
import { logger } from "@hanzo/shared/src/server";

interface ProvisionOrgObservabilityInput {
  orgId: string;
  orgName: string;
}

interface ObservabilityConfig {
  umamiTeamId?: string;
  analyticsWebsiteId?: string;
  insightsOrgId?: string;
  insightsProjectId?: number;
  insightsApiKey?: string;
}

const headers = (token: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

/**
 * Provisions observability resources for a newly created organization:
 * 1. Creates an Umami team and a default website assigned to it
 * 2. Creates an Insights organization and a Production project
 *
 * Returns config to be stored in org's cloudConfig.
 */
export async function provisionOrgObservability(input: ProvisionOrgObservabilityInput): Promise<ObservabilityConfig> {
  const config: ObservabilityConfig = {};

  await Promise.all([provisionUmami(input, config), provisionInsights(input, config)]);

  return config;
}

async function provisionUmami(input: ProvisionOrgObservabilityInput, config: ObservabilityConfig): Promise<void> {
  if (!env.ANALYTICS_API_URL || !env.ANALYTICS_SERVICE_TOKEN) return;

  const baseUrl = env.ANALYTICS_API_URL;
  const auth = headers(env.ANALYTICS_SERVICE_TOKEN);

  try {
    // 1. Create team for the org
    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ name: input.orgName }),
    });

    if (!teamRes.ok) {
      logger.error(`Failed to create Umami team for org ${input.orgId}: ${teamRes.status} ${await teamRes.text()}`);
      return;
    }

    const team = (await teamRes.json()) as { id: string };
    config.umamiTeamId = team.id;
    logger.info(`Created Umami team for org ${input.orgId}: ${team.id}`);

    // 2. Create default website assigned to the team
    const siteRes = await fetch(`${baseUrl}/api/teams/${team.id}/websites`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        name: `${input.orgName} Production`,
        domain: `${input.orgName.toLowerCase()}.hanzo.ai`,
      }),
    });

    if (siteRes.ok) {
      const website = (await siteRes.json()) as { id: string };
      config.analyticsWebsiteId = website.id;
      logger.info(`Created Umami website for org ${input.orgId}: ${website.id}`);
    } else {
      logger.error(`Failed to create Umami website for org ${input.orgId}: ${siteRes.status} ${await siteRes.text()}`);
    }
  } catch (e) {
    logger.error(`Error provisioning Umami for org ${input.orgId}`, e instanceof Error ? e.message : String(e));
  }
}

async function provisionInsights(input: ProvisionOrgObservabilityInput, config: ObservabilityConfig): Promise<void> {
  if (!env.INSIGHTS_API_URL || !env.INSIGHTS_SERVICE_TOKEN) return;

  const baseUrl = env.INSIGHTS_API_URL;
  const auth = headers(env.INSIGHTS_SERVICE_TOKEN);

  try {
    // 1. Create organization
    const orgRes = await fetch(`${baseUrl}/api/organizations/`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ name: input.orgName }),
    });

    if (!orgRes.ok) {
      logger.error(`Failed to create Insights org for ${input.orgId}: ${orgRes.status} ${await orgRes.text()}`);
      return;
    }

    const org = (await orgRes.json()) as { id: string };
    config.insightsOrgId = org.id;
    logger.info(`Created Insights org for ${input.orgId}: ${org.id}`);

    // 2. Create project under the organization
    // Insights API: POST /api/organizations/:id/projects/
    const projRes = await fetch(`${baseUrl}/api/organizations/${org.id}/projects/`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        name: `${input.orgName} Production`,
      }),
    });

    if (projRes.ok) {
      const project = (await projRes.json()) as {
        id: number;
        api_token: string;
      };
      config.insightsProjectId = project.id;
      config.insightsApiKey = project.api_token;
      logger.info(`Created Insights project for ${input.orgId}: ${project.id}`);
    } else {
      logger.error(`Failed to create Insights project for ${input.orgId}: ${projRes.status} ${await projRes.text()}`);
    }
  } catch (e) {
    logger.error(`Error provisioning Insights for org ${input.orgId}`, e instanceof Error ? e.message : String(e));
  }
}
