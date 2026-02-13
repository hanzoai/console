import * as z from "zod/v4";

import { throwIfNoEntitlement } from "@/src/features/entitlements/server/hasEntitlement";

import { createTRPCRouter, protectedOrganizationProcedure } from "@/src/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { throwIfNoOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { auditLog } from "@/src/features/audit-logs/auditLog";
import { logger } from "@hanzo/shared/src/server";
import { createBillingServiceFromContext } from "./billingService";
import { isCloudBillingEnabled } from "../utils/isCloudBilling";

export const cloudBillingRouter = createTRPCRouter({
  getSubscriptionInfo: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        opId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      throwIfNoEntitlement({
        entitlement: "cloud-billing",
        sessionUser: ctx.session.user,
        orgId: input.orgId,
      });
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });

      // Return null for non-cloud environments to avoid 500 errors
      if (!isCloudBillingEnabled()) {
        logger.info("cloudBilling.getSubscriptionInfo called in non-cloud environment, returning null", {
          orgId: input.orgId,
        });
        return {
          cancellation: null,
          scheduledChange: null,
          billingPeriod: null,
          hasValidPaymentMethod: false,
        };
      }

      const res = await createBillingServiceFromContext(ctx).getSubscriptionInfo(input.orgId);
      return res;
    }),
  createCheckoutSession: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        productId: z.string(),
        opId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });
      throwIfNoEntitlement({
        entitlement: "cloud-billing",
        sessionUser: ctx.session.user,
        orgId: input.orgId,
      });

      if (!isCloudBillingEnabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Cloud billing is not available in this environment. This feature requires NEXT_PUBLIC_HANZO_CLOUD_REGION to be configured.",
        });
      }

      const billingService = createBillingServiceFromContext(ctx);
      const url = await billingService.createCheckoutSession(input.orgId, input.productId);

      void auditLog({
        session: ctx.session,
        orgId: input.orgId,
        resourceType: "organization",
        resourceId: input.orgId,
        action: "BillingService.createCheckoutSession",
      });

      return url;
    }),
  changeSubscriptionProduct: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        productId: z.string(),
        opId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });
      throwIfNoEntitlement({
        entitlement: "cloud-billing",
        sessionUser: ctx.session.user,
        orgId: input.orgId,
      });

      if (!isCloudBillingEnabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Cloud billing is not available in this environment. This feature requires NEXT_PUBLIC_HANZO_CLOUD_REGION to be configured.",
        });
      }

      const billingService = createBillingServiceFromContext(ctx);

      await billingService.changePlan(input.orgId, input.productId);
    }),
  cancelSubscription: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        opId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });
      throwIfNoEntitlement({
        entitlement: "cloud-billing",
        sessionUser: ctx.session.user,
        orgId: input.orgId,
      });

      if (!isCloudBillingEnabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Cloud billing is not available in this environment. This feature requires NEXT_PUBLIC_HANZO_CLOUD_REGION to be configured.",
        });
      }

      const billingService = createBillingServiceFromContext(ctx);

      await billingService.cancel(input.orgId, input.opId);

      return { ok: true } as const;
    }),
  reactivateSubscription: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        opId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });
      throwIfNoEntitlement({
        entitlement: "cloud-billing",
        sessionUser: ctx.session.user,
        orgId: input.orgId,
      });

      if (!isCloudBillingEnabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Cloud billing is not available in this environment. This feature requires NEXT_PUBLIC_HANZO_CLOUD_REGION to be configured.",
        });
      }

      const billingService = createBillingServiceFromContext(ctx);

      await billingService.reactivate(input.orgId, input.opId);

      return { ok: true } as const;
    }),
  clearPlanSwitchSchedule: protectedOrganizationProcedure
    .input(z.object({ orgId: z.string(), opId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });
      throwIfNoEntitlement({
        entitlement: "cloud-billing",
        sessionUser: ctx.session.user,
        orgId: input.orgId,
      });

      if (!isCloudBillingEnabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Cloud billing is not available in this environment. This feature requires NEXT_PUBLIC_HANZO_CLOUD_REGION to be configured.",
        });
      }

      const billingService = createBillingServiceFromContext(ctx);

      await billingService.clearPlanSwitchSchedule(input.orgId, input.opId);

      return { ok: true } as const;
    }),
  getCustomerPortalUrl: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        opId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      throwIfNoEntitlement({
        entitlement: "cloud-billing",
        sessionUser: ctx.session.user,
        orgId: input.orgId,
      });
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });

      if (!isCloudBillingEnabled()) {
        logger.info("cloudBilling.getCustomerPortalUrl called in non-cloud environment, returning null", {
          orgId: input.orgId,
        });
        return null;
      }

      try {
        return await createBillingServiceFromContext(ctx).getCustomerPortalUrl(input.orgId);
      } catch (error) {
        logger.error("cloudBilling.getCustomerPortalUrl:error", {
          orgId: input.orgId,
          error,
        });
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Billing error: ${error instanceof Error ? error.message : "Unknown billing error"}`,
          cause: error as Error,
        });
      }
    }),
  getInvoices: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        limit: z.number().int().min(1).max(100).default(10),
        startingAfter: z.string().optional(),
        endingBefore: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      throwIfNoEntitlement({
        entitlement: "cloud-billing",
        sessionUser: ctx.session.user,
        orgId: input.orgId,
      });
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });

      if (!isCloudBillingEnabled()) {
        logger.info("cloudBilling.getInvoices called in non-cloud environment, returning empty", {
          orgId: input.orgId,
        });
        return { invoices: [], hasMore: false, cursors: {} };
      }

      try {
        return await createBillingServiceFromContext(ctx).getInvoices(input.orgId, {
          limit: input.limit,
          startingAfter: input.startingAfter,
          endingBefore: input.endingBefore,
        });
      } catch (error) {
        logger.error("cloudBilling.getInvoices:error", {
          orgId: input.orgId,
          error,
        });
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Billing error: ${error instanceof Error ? error.message : "Unknown billing error"}`,
          cause: error as Error,
        });
      }
    }),
  getUsage: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        opId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      throwIfNoEntitlement({
        entitlement: "cloud-billing",
        sessionUser: ctx.session.user,
        orgId: input.orgId,
      });
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });

      // Return null for non-cloud environments to avoid 500 errors
      if (!isCloudBillingEnabled()) {
        logger.info("cloudBilling.getUsage called in non-cloud environment, returning null", { orgId: input.orgId });
        return null;
      }

      const billingService = createBillingServiceFromContext(ctx);

      return await billingService.getUsage(input.orgId);
    }),
  applyPromotionCode: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        code: z.string().min(1),
        opId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoEntitlement({
        entitlement: "cloud-billing",
        sessionUser: ctx.session.user,
        orgId: input.orgId,
      });
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });

      if (!isCloudBillingEnabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Cloud billing is not available in this environment. This feature requires NEXT_PUBLIC_HANZO_CLOUD_REGION to be configured.",
        });
      }

      const billingService = createBillingServiceFromContext(ctx);

      const result = await billingService.applyPromotionCode(input.orgId, input.code, input.opId);

      return result;
    }),
});
