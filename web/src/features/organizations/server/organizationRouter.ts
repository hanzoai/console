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
import { redis } from "@langfuse/shared/src/server";

export const organizationsRouter = createTRPCRouter({
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
      })
    )
    .query(async ({ input, ctx }) => {
      const organization = await ctx.prisma.organization.findUnique({
        where: { id: input.orgId },
        select: {
          id: true,
          name: true,
          cloudConfig: true,
          stripeCustomerId: true,
          subscriptionId: true,
          subscriptionStatus: true,
          currentPeriodEnd: true,
        }
      });

      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Extract credits from cloudConfig, default to 0 if not present
      const credits = (() => {
        try {
          // Ensure cloudConfig exists and is an object
          const config = organization.cloudConfig || {};
          const creditsValue = typeof config === 'object' 
            ? (config as Record<string, unknown>)?.credits 
            : undefined;
          
          // Validate and convert credits
          const parsedCredits = creditsValue !== undefined 
            ? Number(creditsValue) 
            : 0;
          
          // Log for debugging
          console.log('Organization Credits Debug', {
            orgId: organization.id,
            rawCloudConfig: organization.cloudConfig,
            extractedCredits: parsedCredits
          });

          return parsedCredits;
        } catch (error) {
          console.error('Error extracting credits', {
            orgId: organization.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return 0;
        }
      })();

      return {
        ...organization,
        credits: Number(credits)
      };
    }),
});
