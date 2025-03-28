import { env } from "@/src/env.mjs";
import { hasEntitlementBasedOnPlan } from "@/src/features/entitlements/server/hasEntitlement";
import { createTRPCRouter, protectedProcedure } from "@/src/server/api/trpc";

export const uiCustomizationRouter = createTRPCRouter({
  get: protectedProcedure.query(({ ctx }) => {
    const hasEntitlement = hasEntitlementBasedOnPlan({
      plan: ctx.session.environment.selfHostedInstancePlan,
      entitlement: "self-host-ui-customization",
    });
    if (!hasEntitlement) return null;

    return {
      hostname: env.HANZO_UI_API_HOST,
      documentationHref: env.HANZO_UI_DOCUMENTATION_HREF,
      supportHref: env.HANZO_UI_SUPPORT_HREF,
      feedbackHref: env.HANZO_UI_FEEDBACK_HREF,
      logoLightModeHref: env.HANZO_UI_LOGO_LIGHT_MODE_HREF,
      logoDarkModeHref: env.HANZO_UI_LOGO_DARK_MODE_HREF,
      defaultModelAdapter: env.HANZO_UI_DEFAULT_MODEL_ADAPTER,
      defaultBaseUrlOpenAI: env.HANZO_UI_DEFAULT_BASE_URL_OPENAI,
      defaultBaseUrlAnthropic: env.HANZO_UI_DEFAULT_BASE_URL_ANTHROPIC,
      defaultBaseUrlAzure: env.HANZO_UI_DEFAULT_BASE_URL_AZURE,
    };
  }),
});
