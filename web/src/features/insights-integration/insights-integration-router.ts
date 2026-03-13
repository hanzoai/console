import { z } from "zod/v4";

import { auditLog } from "@/src/features/audit-logs/auditLog";
import { throwIfNoProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { createTRPCRouter, protectedProjectProcedure } from "@/src/server/api/trpc";
import { decrypt, encrypt } from "@hanzo/console-core/encryption";
import { insightsIntegrationFormSchema } from "@/src/features/insights-integration/types";
import { TRPCError } from "@trpc/server";
import { env } from "@/src/env.mjs";
import { validateWebhookURL } from "@hanzo/console-core/src/server";

export const insightsIntegrationRouter = createTRPCRouter({
  get: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async ({ input, ctx }) => {
    throwIfNoProjectAccess({
      session: ctx.session,
      projectId: input.projectId,
      scope: "integrations:CRUD",
    });
    try {
      const dbConfig = await ctx.prisma.insightsIntegration.findFirst({
        where: {
          projectId: input.projectId,
        },
      });

      if (!dbConfig) {
        return null;
      }

      const { encryptedInsightsApiKey, exportSource, ...config } = dbConfig;

      return {
        ...config,
        exportSource,
        insightsApiKey: decrypt(encryptedInsightsApiKey),
      };
    } catch (e) {
      console.error("insights integration get", e);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
      });
    }
  }),

  update: protectedProjectProcedure
    .input(insightsIntegrationFormSchema.extend({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "integrations:CRUD",
      });
      if (!env.ENCRYPTION_KEY) {
        if (env.NEXT_PUBLIC_HANZO_CLOUD_REGION) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal server error",
          });
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Missing environment variable: `ENCRYPTION_KEY`. Please consult our docs: https://hanzo.ai/self-hosting",
          });
        }
      }

      // Validate Hanzo Insights hostname to prevent SSRF attacks
      try {
        await validateWebhookURL(input.insightsHostname);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? `Invalid Hanzo Insights hostname: ${error.message}`
              : "Invalid Hanzo Insights hostname",
        });
      }

      await auditLog({
        session: ctx.session,
        action: "update",
        resourceType: "insightsIntegration",
        resourceId: input.projectId,
      });
      const { insightsProjectApiKey, ...config } = input;

      const encryptedInsightsApiKey = encrypt(insightsProjectApiKey);

      await ctx.prisma.insightsIntegration.upsert({
        where: {
          projectId: input.projectId,
        },
        create: {
          projectId: input.projectId,
          insightsHostName: config.insightsHostname,
          encryptedInsightsApiKey,
          enabled: config.enabled,
          exportSource: config.exportSource,
        },
        update: {
          encryptedInsightsApiKey,
          insightsHostName: config.insightsHostname,
          enabled: config.enabled,
          exportSource: config.exportSource,
        },
      });
    }),
  delete: protectedProjectProcedure.input(z.object({ projectId: z.string() })).mutation(async ({ input, ctx }) => {
    try {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "integrations:CRUD",
      });
      await auditLog({
        session: ctx.session,
        action: "delete",
        resourceType: "insightsIntegration",
        resourceId: input.projectId,
      });

      await ctx.prisma.insightsIntegration.delete({
        where: {
          projectId: input.projectId,
        },
      });
    } catch (e) {
      console.log("insights integration delete", e);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
      });
    }
  }),
});
