import { createTRPCRouter, protectedOrganizationProcedure, authenticatedProcedure } from "@/src/server/api/trpc";
import { auditLog } from "@/src/features/audit-logs/auditLog";
import {
  organizationOptionalNameSchema,
  organizationNameSchema,
} from "@/src/features/organizations/utils/organizationNameSchema";
import * as z from "zod/v4";
import { throwIfNoOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { TRPCError } from "@trpc/server";
import { ApiAuthService } from "@/src/features/public-api/server/apiAuth";
import { parseDbOrg } from "@hanzo/shared";
import { redis } from "@hanzo/shared/src/server";
import { createBillingServiceFromContext } from "@/src/ee/features/billing/server/billingService";
import { isCloudBillingEnabled } from "@/src/ee/features/billing/utils/isCloudBilling";

import { env } from "@/src/env.mjs";
import { addDaysAndRoundToNextDay } from "@/src/features/organizations/utils/converTime";

export const organizationsRouter = createTRPCRouter({
  create: authenticatedProcedure.input(organizationNameSchema).mutation(async ({ input, ctx }) => {
    if (!ctx.session.user.canCreateOrganizations)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to create organizations",
      });

    const organization = await ctx.prisma.organization.create({
      data: {
        name: input.name,
        organizationMemberships: {
          create: {
            userId: ctx.session.user.id,
            role: "OWNER",
          },
        },
        // Store trial expiry in cloudConfig
        cloudConfig: {
          plan: "free",
          trialExpiresAt: addDaysAndRoundToNextDay(
            Number(env.HANZO_TRIAL_EXPIRE) || 90, // default 90 day if not config in env
          ).toISOString(),
        },
      },
    });
    await auditLog({
      resourceType: "organization",
      resourceId: organization.id,
      action: "create",
      orgId: organization.id,
      orgRole: "OWNER",
      userId: ctx.session.user.id,
      after: organization,
    });

    return {
      id: organization.id,
      name: organization.name,
      role: "OWNER",
    };
  }),
  update: protectedOrganizationProcedure
    .input(
      organizationOptionalNameSchema
        .extend({
          orgId: z.string(),
          aiFeaturesEnabled: z.boolean().optional(),
        })
        .refine((data) => data.name || data.aiFeaturesEnabled !== undefined, {
          message: "At least one of name or aiFeaturesEnabled is required",
        }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        session: ctx.session,
        organizationId: input.orgId,
        scope: "organization:update",
      });

      if (input.aiFeaturesEnabled !== undefined && !env.NEXT_PUBLIC_HANZO_CLOUD_REGION) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Natural language filtering is not available in self-hosted deployments.",
        });
      }

      const beforeOrganization = await ctx.prisma.organization.findFirst({
        where: {
          id: input.orgId,
        },
      });
      const afterOrganization = await ctx.prisma.organization.update({
        where: {
          id: input.orgId,
        },
        data: {
          name: input.name,
          aiFeaturesEnabled: input.aiFeaturesEnabled,
        },
      });

      await auditLog({
        session: ctx.session,
        resourceType: "organization",
        resourceId: input.orgId,
        action: "update",
        before: beforeOrganization,
        after: afterOrganization,
      });

      return true;
    }),
  delete: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        session: ctx.session,
        organizationId: input.orgId,
        scope: "organization:delete",
      });

      // count non-deleted projects
      const countNonDeletedProjects = await ctx.prisma.project.count({
        where: {
          orgId: input.orgId,
          deletedAt: null,
        },
      });

      // count all projects (including soft-deleted)
      const countAllProjects = await ctx.prisma.project.count({
        where: {
          orgId: input.orgId,
        },
      });

      if (countNonDeletedProjects > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Please delete or transfer all projects before deleting the organization.",
        });
      }

      if (countAllProjects > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Deletion of your projects is still being processed, please try deleting the organization later",
        });
      }

      // Attempt to cancel subscription immediately (Cloud only) before deleting org
      if (isCloudBillingEnabled()) {
        try {
          const billingService = createBillingServiceFromContext(ctx);
          await billingService.cancelImmediatelyAndInvoice(input.orgId);
        } catch (e) {
          // If billing cancellation fails for reasons other than no subscription, abort deletion
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to cancel subscription prior to organization deletion",
            cause: e as Error,
          });
        }
      }

      const organization = await ctx.prisma.organization.delete({
        where: {
          id: input.orgId,
        },
      });

      // the api keys contain which org they belong to, so we need to remove them from Redis
      await new ApiAuthService(ctx.prisma, redis).invalidateCachedOrgApiKeys(input.orgId);

      await auditLog({
        session: ctx.session,
        resourceType: "organization",
        resourceId: input.orgId,
        action: "delete",
        before: organization,
      });

      return true;
    }),
  getDetails: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const organization = await ctx.prisma.organization.findUnique({
        where: { id: input.orgId },
        // select: {
        //   id: true,
        //   name: true,
        //   cloudConfig: true,
        //   credits: true,
        //   usageMeters: true,
        //   created_at
        // }
      });

      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Extract credits from cloudConfig, default to 0 if not present
      const parsedOrg = parseDbOrg(organization);
      const credits = parsedOrg.cloudConfig?.credits ?? 0;

      return {
        ...organization,
        credits: Number(credits),
      };
    }),
  updateCredits: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        credits: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        session: ctx.session,
        organizationId: input.orgId,
        scope: "organization:update",
      });

      // Get current organization to update cloudConfig
      const org = await ctx.prisma.organization.findUnique({
        where: { id: input.orgId },
      });
      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }
      const parsedOrg = parseDbOrg(org);

      await ctx.prisma.organization.update({
        where: { id: input.orgId },
        data: {
          cloudConfig: {
            ...parsedOrg.cloudConfig,
            credits: input.credits,
          },
        },
      });

      return true;
    }),
});
