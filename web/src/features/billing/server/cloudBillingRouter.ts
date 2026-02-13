import {
  commerceGet,
  commercePost,
  commercePatch,
  commerceDelete,
} from "@/src/features/billing/server/commerceClient";
import { env } from "@/src/env.mjs";
import { throwIfNoEntitlement } from "@/src/features/entitlements/server/hasEntitlement";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/src/server/api/trpc";
import { TRPCError } from "@trpc/server";
import * as z from "zod";
import { throwIfNoOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { auditLog } from "@/src/features/audit-logs/auditLog";

/** Headers to pass org-scoped requests to the Commerce service. */
function orgHeaders(orgId: string): Record<string, string> {
  return { "X-Org-ID": orgId };
}

export const cloudBillingRouter = createTRPCRouter({
  createCheckoutSession: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        productId: z.string(),
        customerEmail: z.string().email().optional(),
        customerName: z.string().optional(),
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

      const result = await commercePost<{
        url: string | null;
        sessionId: string;
      }>(
        "/checkout/authorize",
        {
          productId: input.productId,
          customerEmail:
            input.customerEmail || ctx.session.user.email || "",
          customerName: input.customerName,
          returnUrl: `${env.NEXTAUTH_URL}/organization/${input.orgId}/settings/billing`,
          cloudRegion: env.NEXT_PUBLIC_HANZO_CLOUD_REGION ?? null,
        },
        undefined,
        orgHeaders(input.orgId),
      );

      auditLog({
        session: ctx.session,
        orgId: input.orgId,
        resourceType: "organization",
        resourceId: result.sessionId,
        action: "create",
      });

      return result;
    }),

  changeSubscriptionProduct: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        productId: z.string(),
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

      await commercePatch(
        "/subscribe/current",
        { productId: input.productId },
        undefined,
        orgHeaders(input.orgId),
      );
    }),

  getCustomerPortalUrl: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
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

      const result = await commercePost<{ url: string | null }>(
        "/billing/portal",
        {
          returnUrl: `${env.NEXTAUTH_URL}/organization/${input.orgId}/settings/billing`,
        },
        undefined,
        orgHeaders(input.orgId),
      );

      return result.url;
    }),

  getUsage: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
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

      const result = await commerceGet<{
        usageCount: number;
        usageType: string;
        billingPeriod?: {
          start: string;
          end: string;
        } | null;
        upcomingInvoice?: {
          usdAmount: number;
          date: string;
        } | null;
      }>("/usage", undefined, orgHeaders(input.orgId));

      return {
        usageCount: result.usageCount,
        usageType: result.usageType,
        billingPeriod: result.billingPeriod
          ? {
              start: new Date(result.billingPeriod.start),
              end: new Date(result.billingPeriod.end),
            }
          : undefined,
        upcomingInvoice: result.upcomingInvoice
          ? {
              usdAmount: result.upcomingInvoice.usdAmount,
              date: new Date(result.upcomingInvoice.date),
            }
          : undefined,
      };
    }),

  getSubscription: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });

      try {
        const result = await commerceGet<{
          id: string;
          status: string;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at: string | null;
          canceled_at: string | null;
          plan: {
            name: string;
            description: string;
            id: string;
          };
          price: {
            amount: number | null;
            currency: string;
          };
        } | null>("/subscribe/current", undefined, orgHeaders(input.orgId));

        if (!result) return null;

        return {
          ...result,
          current_period_start: result.current_period_start
            ? new Date(result.current_period_start)
            : null,
          current_period_end: result.current_period_end
            ? new Date(result.current_period_end)
            : null,
          cancel_at: result.cancel_at
            ? new Date(result.cancel_at)
            : null,
          canceled_at: result.canceled_at
            ? new Date(result.canceled_at)
            : null,
        };
      } catch {
        return null;
      }
    }),

  saveSubscriptionData: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        subscriptionId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });

      const result = await commercePost<{
        success: boolean;
        subscriptionId: string;
      }>(
        `/subscribe/${input.subscriptionId}/save`,
        {},
        undefined,
        orgHeaders(input.orgId),
      );

      auditLog({
        session: ctx.session,
        orgId: input.orgId,
        resourceType: "organization",
        resourceId: input.subscriptionId,
        action: "create",
      });

      return result;
    }),

  getSubscriptionHistory: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        limit: z.number().optional().default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });

      const result = await commerceGet<{
        subscriptions: Array<{
          id: string;
          status: string;
          plan: {
            name: string;
            amount: number;
            billingPeriod: {
              start: string;
              end: string;
            } | null;
          };
          latestInvoice: {
            id: string;
            amountDue: number;
            status: string | null;
            number: string;
            pdfUrl: string | null;
          } | null;
        }>;
        hasMore: boolean;
      }>(
        "/subscriptions/history",
        { limit: String(input.limit) },
        orgHeaders(input.orgId),
      );

      return result;
    }),

  getInvoicePdfUrl: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        invoiceId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });

      return commerceGet<{
        pdfUrl: string;
        invoiceNumber: string;
        amountDue: number;
        invoiceDate: string;
      }>(
        `/invoices/${input.invoiceId}/pdf`,
        undefined,
        orgHeaders(input.orgId),
      );
    }),

  cancelSubscription: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        productId: z.string(),
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

      const result = await commerceDelete<{
        success: boolean;
        message: string;
        cancelAt: string | null;
      }>(
        "/subscribe/current",
        { productId: input.productId },
        orgHeaders(input.orgId),
      );

      auditLog({
        session: ctx.session,
        orgId: input.orgId,
        resourceType: "organization",
        resourceId: input.orgId,
        action: "cancel",
      });

      return {
        success: result.success,
        message: result.message,
        cancelAt: result.cancelAt ? new Date(result.cancelAt) : null,
      };
    }),
});
