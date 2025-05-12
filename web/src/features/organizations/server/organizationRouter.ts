import {
  createTRPCRouter,
  protectedOrganizationProcedure,
  protectedProcedure,
} from "@/src/server/api/trpc";
import { auditLog } from "@/src/features/audit-logs/auditLog";
import { organizationNameSchema } from "@/src/features/organizations/utils/organizationNameSchema";
import * as z from "zod";
import { throwIfNoOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { TRPCError } from "@trpc/server";
import { ApiAuthService } from "@/src/features/public-api/server/apiAuth";
import { redis } from "@hanzo/shared/src/server";
import { env } from "@/src/env.mjs";
import { addDaysAndRoundToNextDay } from "@/src/features/organizations/utils/converTime";

export const organizationsRouter = createTRPCRouter({
  // update credit when expired
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

      await ctx.prisma.organization.update({
        where: {
          id: input.orgId,
        },
        data: {
          credits: input.credits,
        },
      });

      await auditLog({
        session: ctx.session,
        resourceType: "organization",
        resourceId: input.orgId,
        action: "update",
        before: { credits: "old_value" },
        after: { credits: input.credits },
      });

      return true;
    }),

  create: protectedProcedure
    .input(organizationNameSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session.user.canCreateOrganizations)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to create organizations",
        });

      const organization = await ctx.prisma.organization.create({
        data: {
          expiredAt: addDaysAndRoundToNextDay(
            Number(env.HANZO_S3_FREE_PLAN_EXPIRE) ?? 90, // default 90 day if not config in env
          ),
          name: input.name,
          organizationMemberships: {
            create: {
              userId: ctx.session.user.id,
              role: "OWNER",
            },
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
      organizationNameSchema.extend({
        orgId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        session: ctx.session,
        organizationId: input.orgId,
        scope: "organization:update",
      });
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

      // count soft and hard deleted projects
      const countProjects = await ctx.prisma.project.count({
        where: {
          orgId: input.orgId,
        },
      });
      if (countProjects > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Please delete or transfer all projects before deleting the organization.",
        });
      }

      const organization = await ctx.prisma.organization.delete({
        where: {
          id: input.orgId,
        },
      });

      // the api keys contain which org they belong to, so we need to remove them from Redis
      await new ApiAuthService(ctx.prisma, redis).invalidateOrgApiKeys(
        input.orgId,
      );

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
      const credits = organization.credits;

      return {
        ...organization,
        credits: Number(credits),
      };
    }),
});
