/**
 * Commerce-backed billing service.
 *
 * All payment operations are delegated to the Hanzo Commerce service which
 * manages per-org payment credentials and namespace-isolated billing.
 * The public API is unchanged so cloudBillingRouter.ts works as before.
 */

import { TRPCError } from "@trpc/server";
import { type OrgAuthedContext } from "@/src/server/api/trpc";
import { SpanKind } from "@opentelemetry/api";

import { env } from "@/src/env.mjs";

import { parseDbOrg } from "@hanzo/shared";
import {
  logger,
  getBillingCycleStart,
  getBillingCycleEnd,
  instrumentAsync,
  traceException,
} from "@hanzo/shared/src/server";

import { auditLog } from "@/src/features/audit-logs/auditLog";
import {
  commerceGet,
  commercePost,
  commercePatch,
  commerceDelete,
} from "@/src/features/billing/server/commerceClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BillingSubscriptionInfo = {
  cancellation: {
    cancelAt: number;
  } | null;
  scheduledChange: {
    scheduleId: string;
    switchAt: number;
    newProductId?: string;
    message?: string | null;
  } | null;
  billingPeriod?: {
    start: Date;
    end: Date;
  } | null;
  discounts?: Array<{
    id: string;
    code: string | null;
    name: string | null;
    kind: "percent" | "amount";
    value: number;
    currency: string | null;
    duration: "forever" | "once" | "repeating" | null;
    durationInMonths: number | null;
  }>;
  hasValidPaymentMethod: boolean;
};

// ---------------------------------------------------------------------------
// Commerce response shapes (what commerce returns)
// ---------------------------------------------------------------------------

interface CommerceSubscription {
  id: string;
  status: string;
  cancel_at?: number | null;
  cancel_at_period_end?: boolean;
  current_period_start?: number;
  current_period_end?: number;
  customer_id?: string;
  product_id?: string;
  has_valid_payment_method?: boolean;
  schedule?: {
    id: string;
    status: string;
    switch_at?: number;
    new_product_id?: string;
    message?: string | null;
  } | null;
  discounts?: Array<{
    id: string;
    code: string | null;
    name: string | null;
    kind: "percent" | "amount";
    value: number;
    currency: string | null;
    duration: "forever" | "once" | "repeating" | null;
    duration_in_months: number | null;
  }>;
}

interface CommerceCheckoutResponse {
  url: string;
  session_id?: string;
}

interface CommercePortalResponse {
  url: string;
}

interface CommerceInvoice {
  id: string | null;
  number: string | null;
  status: string | null;
  currency: string;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  breakdown: {
    subscription_cents: number;
    usage_cents: number;
    discount_cents: number;
    tax_cents: number;
    total_cents: number;
  };
}

interface CommerceInvoicesResponse {
  invoices: CommerceInvoice[];
  has_more: boolean;
  cursors: {
    next?: string;
    prev?: string;
  };
}

interface CommerceUsageResponse {
  usage_count: number;
  usage_type: string;
  billing_period: {
    start: string;
    end: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build X-Org-ID header for commerce multi-tenancy. */
function orgHeaders(orgId: string): Record<string, string> {
  return { "X-Org-ID": orgId };
}

// ---------------------------------------------------------------------------
// BillingService — delegates everything to commerce
// ---------------------------------------------------------------------------

class BillingService {
  constructor(private ctx: OrgAuthedContext) {}

  private async getParsedOrg(orgId: string) {
    const org = await this.ctx.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Organization not found",
      });
    }
    return { org, parsedOrg: parseDbOrg(org) } as const;
  }

  private async getParsedOrgWithProjects(orgId: string) {
    const org = await this.ctx.prisma.organization.findUnique({
      where: { id: orgId },
      include: { projects: { select: { id: true } } },
    });
    if (!org) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Organization not found",
      });
    }
    return { org, parsedOrg: parseDbOrg(org) };
  }

  // ==========================================================================
  // Public methods
  // ==========================================================================

  async getSubscriptionInfo(orgId: string): Promise<BillingSubscriptionInfo> {
    return await instrumentAsync(
      { name: "commerce.subscription.getInfo", spanKind: SpanKind.CLIENT },
      async (span) => {
        const { org, parsedOrg } = await this.getParsedOrg(orgId);

        span.setAttributes({
          "hanzo.org.id": parsedOrg.id,
          "commerce.operation": "get_subscription_info",
        });

        const subscriptionId =
          parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;

        if (!subscriptionId) {
          const now = new Date();
          const billingCycleStart = getBillingCycleStart(org, now);
          const billingCycleEnd = getBillingCycleEnd(org, now);
          return {
            cancellation: null,
            scheduledChange: null,
            billingPeriod: { start: billingCycleStart, end: billingCycleEnd },
            hasValidPaymentMethod: false,
          };
        }

        try {
          const sub = await commerceGet<CommerceSubscription>(
            `/subscribe/${subscriptionId}`,
            undefined,
            orgHeaders(orgId),
          );

          // Map cancellation
          const nowSec = Math.floor(Date.now() / 1000);
          let cancellation: { cancelAt: number } | null = null;
          if (
            typeof sub.cancel_at === "number" &&
            sub.cancel_at > nowSec
          ) {
            cancellation = { cancelAt: sub.cancel_at };
          } else if (
            sub.cancel_at_period_end &&
            typeof sub.current_period_end === "number" &&
            sub.current_period_end > nowSec
          ) {
            cancellation = { cancelAt: sub.current_period_end };
          }

          // Billing period
          const billingPeriod =
            sub.current_period_start && sub.current_period_end
              ? {
                  start: new Date(sub.current_period_start * 1000),
                  end: new Date(sub.current_period_end * 1000),
                }
              : null;

          // Scheduled change
          let scheduledChange: BillingSubscriptionInfo["scheduledChange"] =
            null;
          if (sub.schedule) {
            scheduledChange = {
              scheduleId: sub.schedule.id,
              switchAt: sub.schedule.switch_at ?? 0,
              newProductId: sub.schedule.new_product_id,
              message: sub.schedule.message ?? null,
            };
          }

          // Discounts
          const discounts = (sub.discounts ?? []).map((d) => ({
            id: d.id,
            code: d.code,
            name: d.name,
            kind: d.kind,
            value: d.value,
            currency: d.currency,
            duration: d.duration,
            durationInMonths: d.duration_in_months,
          }));

          return {
            cancellation,
            scheduledChange,
            billingPeriod,
            discounts,
            hasValidPaymentMethod: sub.has_valid_payment_method ?? false,
          };
        } catch (error) {
          logger.error(
            "commerceBillingService.getSubscriptionInfo:failed",
            { orgId, subscriptionId, error },
          );
          traceException(error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get subscription info: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      },
    );
  }

  async getCustomerPortalUrl(orgId: string): Promise<string> {
    return await instrumentAsync(
      { name: "commerce.billingPortal.create", spanKind: SpanKind.CLIENT },
      async (span) => {
        const { parsedOrg } = await this.getParsedOrg(orgId);

        span.setAttributes({
          "hanzo.org.id": parsedOrg.id,
          "hanzo.user.id": this.ctx.session.user.id,
        });

        const returnUrl = `${env.NEXTAUTH_URL}/organization/${orgId}/settings/billing`;

        try {
          const result = await commercePost<CommercePortalResponse>(
            "/billing/portal",
            {
              return_url: returnUrl,
              customer_id: parsedOrg.cloudConfig?.stripe?.customerId,
            },
            undefined,
            orgHeaders(orgId),
          );
          return result.url;
        } catch (error) {
          logger.error(
            "commerceBillingService.billingPortal.create:failed",
            { orgId, error },
          );
          traceException(error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to create billing portal session: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      },
    );
  }

  async createCheckoutSession(
    orgId: string,
    productId: string,
  ): Promise<string> {
    return await instrumentAsync(
      { name: "commerce.checkout.create", spanKind: SpanKind.CLIENT },
      async (span) => {
        const { parsedOrg } = await this.getParsedOrg(orgId);

        if (parsedOrg.cloudConfig?.plan) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Cannot initialize checkout for orgs with a manual plan override",
          });
        }

        span.setAttributes({
          "commerce.product_id": productId,
          "hanzo.org.id": parsedOrg.id,
          "hanzo.user.id": this.ctx.session.user.id,
        });

        const returnUrl = `${env.NEXTAUTH_URL}/organization/${orgId}/settings/billing`;

        try {
          const result = await commercePost<CommerceCheckoutResponse>(
            "/checkout/authorize",
            {
              product_id: productId,
              customer_id: parsedOrg.cloudConfig?.stripe?.customerId,
              org_id: orgId,
              success_url: returnUrl,
              cancel_url: returnUrl,
              cloud_region: env.NEXT_PUBLIC_HANZO_CLOUD_REGION,
              user_id: this.ctx.session.user.id,
              user_email: this.ctx.session.user.email,
            },
            undefined,
            orgHeaders(orgId),
          );

          if (!result.url) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create checkout session — no URL returned",
            });
          }

          void auditLog({
            session: this.ctx.session,
            orgId: parsedOrg.id,
            resourceType: "organization",
            resourceId: parsedOrg.id,
            action: "BillingService.createCheckoutSession",
            before: parsedOrg.cloudConfig,
          });

          return result.url;
        } catch (error) {
          logger.error(
            "commerceBillingService.checkout.create:failed",
            { orgId, productId, error },
          );
          traceException(error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to create checkout session: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      },
    );
  }

  async changePlan(
    orgId: string,
    newProductId: string,
    opId?: string,
  ): Promise<void> {
    return await instrumentAsync(
      { name: "commerce.subscription.changePlan", spanKind: SpanKind.CLIENT },
      async (span) => {
        const { parsedOrg } = await this.getParsedOrg(orgId);

        if (parsedOrg.cloudConfig?.plan) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Cannot change plan for orgs with a manually set plan",
          });
        }

        const subscriptionId =
          parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;
        if (!subscriptionId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Organization does not have an active subscription",
          });
        }

        span.setAttributes({
          "commerce.subscription_id": subscriptionId,
          "commerce.new_product_id": newProductId,
          "hanzo.org.id": parsedOrg.id,
          "hanzo.user.id": this.ctx.session.user.id,
        });

        try {
          await commercePatch(
            `/subscribe/${subscriptionId}`,
            {
              product_id: newProductId,
              op_id: opId,
              user_id: this.ctx.session.user.id,
              user_email: this.ctx.session.user.email,
            },
            undefined,
            orgHeaders(orgId),
          );

          void auditLog({
            session: this.ctx.session,
            orgId: parsedOrg.id,
            resourceType: "organization",
            resourceId: parsedOrg.id,
            action: "BillingService.changePlan",
            before: parsedOrg.cloudConfig,
            after: "commerce",
          });
        } catch (error) {
          logger.error(
            "commerceBillingService.changePlan:failed",
            { orgId, subscriptionId, newProductId, error },
          );
          traceException(error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to change plan: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      },
    );
  }

  async cancel(orgId: string, opId?: string) {
    return await instrumentAsync(
      { name: "commerce.subscription.cancel", spanKind: SpanKind.CLIENT },
      async (span) => {
        const { parsedOrg } = await this.getParsedOrg(orgId);

        const subscriptionId =
          parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;
        if (!subscriptionId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No active subscription to cancel",
          });
        }

        span.setAttributes({
          "commerce.subscription_id": subscriptionId,
          "hanzo.org.id": parsedOrg.id,
          "hanzo.user.id": this.ctx.session.user.id,
        });

        try {
          await commerceDelete(
            `/subscribe/${subscriptionId}`,
            {
              cancel_at_period_end: "true",
              op_id: opId,
            },
            orgHeaders(orgId),
          );

          void auditLog({
            session: this.ctx.session,
            orgId: parsedOrg.id,
            resourceType: "organization",
            resourceId: parsedOrg.id,
            action: "BillingService.cancel",
            before: parsedOrg.cloudConfig,
            after: "commerce",
          });

          return { status: "success" };
        } catch (error) {
          logger.error(
            "commerceBillingService.cancel:failed",
            { orgId, subscriptionId, error },
          );
          traceException(error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to cancel subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      },
    );
  }

  async reactivate(orgId: string, opId?: string) {
    return await instrumentAsync(
      { name: "commerce.subscription.reactivate", spanKind: SpanKind.CLIENT },
      async (span) => {
        const { parsedOrg } = await this.getParsedOrg(orgId);

        const subscriptionId =
          parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;
        if (!subscriptionId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No active subscription to reactivate",
          });
        }

        span.setAttributes({
          "commerce.subscription_id": subscriptionId,
          "hanzo.org.id": parsedOrg.id,
          "hanzo.user.id": this.ctx.session.user.id,
        });

        try {
          await commercePatch(
            `/subscribe/${subscriptionId}`,
            {
              reactivate: true,
              op_id: opId,
              user_id: this.ctx.session.user.id,
              user_email: this.ctx.session.user.email,
            },
            undefined,
            orgHeaders(orgId),
          );

          void auditLog({
            session: this.ctx.session,
            orgId: parsedOrg.id,
            resourceType: "organization",
            resourceId: parsedOrg.id,
            action: "BillingService.reactivate",
            before: parsedOrg.cloudConfig,
            after: "commerce",
          });

          return { status: "success" };
        } catch (error) {
          logger.error(
            "commerceBillingService.reactivate:failed",
            { orgId, subscriptionId, error },
          );
          traceException(error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to reactivate subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      },
    );
  }

  async cancelImmediatelyAndInvoice(orgId: string, opId?: string) {
    return await instrumentAsync(
      {
        name: "commerce.subscription.cancelImmediately",
        spanKind: SpanKind.CLIENT,
      },
      async (span) => {
        const { parsedOrg } = await this.getParsedOrg(orgId);

        const subscriptionId =
          parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;
        if (!subscriptionId) {
          logger.info(
            "commerceBillingService.cancel.now:noop.noActiveSubscription",
            { orgId },
          );
          return { status: "noop" as const };
        }

        span.setAttributes({
          "commerce.subscription_id": subscriptionId,
          "hanzo.org.id": parsedOrg.id,
          "hanzo.user.id": this.ctx.session.user?.id ?? "system",
        });

        try {
          await commerceDelete(
            `/subscribe/${subscriptionId}`,
            {
              immediate: "true",
              invoice_now: "true",
              op_id: opId,
            },
            orgHeaders(orgId),
          );

          void auditLog({
            session: this.ctx.session,
            orgId: parsedOrg.id,
            resourceType: "organization",
            resourceId: parsedOrg.id,
            action: "BillingService.cancelImmediatelyAndInvoice",
            before: parsedOrg.cloudConfig,
            after: "commerce",
          });

          return { status: "success" as const };
        } catch (error) {
          logger.error(
            "commerceBillingService.cancel.now:failed",
            { orgId, subscriptionId, error },
          );
          traceException(error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to cancel subscription immediately: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      },
    );
  }

  async clearPlanSwitchSchedule(orgId: string, opId?: string) {
    return await instrumentAsync(
      { name: "commerce.subscription.clearSchedule", spanKind: SpanKind.CLIENT },
      async (span) => {
        const { parsedOrg } = await this.getParsedOrg(orgId);

        const subscriptionId =
          parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;
        if (!subscriptionId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No active subscription found",
          });
        }

        span.setAttributes({
          "commerce.subscription_id": subscriptionId,
          "hanzo.org.id": parsedOrg.id,
          "hanzo.user.id": this.ctx.session.user.id,
        });

        try {
          await commercePost(
            `/subscribe/${subscriptionId}/clear-schedule`,
            { op_id: opId },
            undefined,
            orgHeaders(orgId),
          );

          void auditLog({
            session: this.ctx.session,
            orgId: parsedOrg.id,
            resourceType: "organization",
            resourceId: parsedOrg.id,
            action: "BillingService.clearPlanSwitchSchedule",
            before: parsedOrg.cloudConfig,
            after: "commerce",
          });

          return { status: "success" };
        } catch (error) {
          logger.error(
            "commerceBillingService.clearSchedule:failed",
            { orgId, subscriptionId, error },
          );
          traceException(error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to clear plan switch schedule: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      },
    );
  }

  async getInvoices(
    orgId: string,
    pagination: {
      limit: number;
      startingAfter?: string;
      endingBefore?: string;
    },
  ) {
    return await instrumentAsync(
      { name: "commerce.invoices.list", spanKind: SpanKind.CLIENT },
      async (span) => {
        const { parsedOrg } = await this.getParsedOrg(orgId);

        const customerId = parsedOrg.cloudConfig?.stripe?.customerId;
        if (!customerId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No billing customer found",
          });
        }

        span.setAttributes({
          "hanzo.org.id": parsedOrg.id,
          "commerce.operation": "list_invoices",
        });

        try {
          const result = await commerceGet<CommerceInvoicesResponse>(
            "/invoices",
            {
              customer_id: customerId,
              subscription_id:
                parsedOrg.cloudConfig?.stripe?.activeSubscriptionId ?? undefined,
              limit: String(pagination.limit),
              starting_after: pagination.startingAfter,
              ending_before: pagination.endingBefore,
            },
            orgHeaders(orgId),
          );

          // Normalize to the shape the frontend expects
          return {
            invoices: result.invoices.map((inv) => ({
              id: inv.id,
              number: inv.number,
              status: inv.status,
              currency: inv.currency,
              created: inv.created,
              hostedInvoiceUrl: inv.hosted_invoice_url,
              invoicePdfUrl: inv.invoice_pdf_url,
              breakdown: {
                subscriptionCents: inv.breakdown.subscription_cents,
                usageCents: inv.breakdown.usage_cents,
                discountCents: inv.breakdown.discount_cents,
                taxCents: inv.breakdown.tax_cents,
                totalCents: inv.breakdown.total_cents,
              },
            })),
            hasMore: result.has_more,
            cursors: result.cursors,
          };
        } catch (error) {
          logger.error("commerceBillingService.getInvoices:failed", {
            orgId,
            error,
          });
          traceException(error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to list invoices: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      },
    );
  }

  async getUsage(orgId: string) {
    return await instrumentAsync(
      { name: "commerce.billing.getUsage", spanKind: SpanKind.CLIENT },
      async (span) => {
        const { org, parsedOrg } = await this.getParsedOrgWithProjects(orgId);

        span.setAttributes({
          "hanzo.org.id": parsedOrg.id,
          "commerce.operation": "get_usage",
        });

        const customerId = parsedOrg.cloudConfig?.stripe?.customerId;
        const subscriptionId =
          parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;

        if (customerId && subscriptionId) {
          try {
            const result = await commerceGet<CommerceUsageResponse>(
              "/usage",
              {
                customer_id: customerId,
                subscription_id: subscriptionId,
              },
              orgHeaders(orgId),
            );
            return {
              usageCount: result.usage_count,
              usageType: result.usage_type,
              billingPeriod: {
                start: new Date(result.billing_period.start),
                end: new Date(result.billing_period.end),
              },
            };
          } catch (e) {
            logger.error(
              "Failed to get usage from Commerce, using fallback",
              { error: e },
            );
            traceException(e);
          }
        }

        // Fallback: use cached org data (hobby plan or error)
        const cachedUsage = org.cloudCurrentCycleUsage ?? 0;
        const now = new Date();
        const billingCycleStart = getBillingCycleStart(org, now);
        const billingCycleEnd = getBillingCycleEnd(org, now);
        return {
          usageCount: cachedUsage,
          usageType: "units",
          billingPeriod: { start: billingCycleStart, end: billingCycleEnd },
        };
      },
    );
  }

  async applyPromotionCode(orgId: string, code: string, opId?: string) {
    return await instrumentAsync(
      {
        name: "commerce.subscription.applyPromotion",
        spanKind: SpanKind.CLIENT,
      },
      async (span) => {
        const { parsedOrg } = await this.getParsedOrg(orgId);

        const subscriptionId =
          parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;
        if (!subscriptionId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Organization does not have an active subscription",
          });
        }

        span.setAttributes({
          "commerce.subscription_id": subscriptionId,
          "hanzo.org.id": parsedOrg.id,
          "commerce.promotion_code": code,
        });

        try {
          await commercePost(
            `/subscribe/${subscriptionId}/promotion`,
            {
              code,
              op_id: opId,
              user_id: this.ctx.session.user?.id,
              user_email: this.ctx.session.user?.email,
            },
            undefined,
            orgHeaders(orgId),
          );

          void auditLog({
            session: this.ctx.session,
            orgId: parsedOrg.id,
            resourceType: "organization",
            resourceId: parsedOrg.id,
            action: "BillingService.applyPromotionCode",
            before: parsedOrg.cloudConfig,
            after: "commerce",
          });

          return { ok: true as const };
        } catch (error) {
          logger.error(
            "commerceBillingService.applyPromotionCode:failed",
            { orgId, subscriptionId, code, error },
          );
          traceException(error);
          if (error instanceof TRPCError) throw error;

          let errorMessage = "Failed to apply promotion code";
          if (error instanceof Error) {
            if (error.message.includes("prior transactions")) {
              errorMessage = "Promotion code only valid for new customers";
            } else {
              errorMessage = error.message;
            }
          }
          throw new TRPCError({ code: "BAD_REQUEST", message: errorMessage });
        }
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Factory (same export name as before so cloudBillingRouter works unchanged)
// ---------------------------------------------------------------------------

export const createBillingServiceFromContext = (ctx: OrgAuthedContext) => {
  return new BillingService(ctx);
};
