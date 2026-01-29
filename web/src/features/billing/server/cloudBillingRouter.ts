import { createStripeClientReference } from "@/src/features/billing/stripeClientReference";
import { stripeClient } from "@/src/features/billing/utils/stripe";
import { stripeProducts } from "@/src/features/billing/utils/stripeProducts";
import { env } from "@/src/env.mjs";
import { throwIfNoEntitlement } from "@/src/features/entitlements/server/hasEntitlement";
import { parseDbOrg } from "@hanzo/shared";
import {
  createTRPCRouter,
  protectedOrganizationProcedure,
} from "@/src/server/api/trpc";
import { TRPCError } from "@trpc/server";
import * as z from "zod";
import { throwIfNoOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { auditLog } from "@/src/features/audit-logs/auditLog";
import { getObservationCountOfProjectsSinceCreationDate } from "@hanzo/shared/src/server";
import type Stripe from "stripe";

export const cloudBillingRouter = createTRPCRouter({
  createStripeCheckoutSession: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        stripeProductId: z.string(),
        customerEmail: z.string().email().optional(),
        customerName: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Access checks
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

        // Find organization
        const org = await ctx.prisma.organization.findUnique({
          where: { id: input.orgId },
        });

        if (!org) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
          });
        }

        // Parse organization configuration
        const parsedOrg = parseDbOrg(org);

        // Stripe client check
        if (!stripeClient) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Stripe client not initialized",
          });
        }

        // Product validation
        const validProducts = stripeProducts.filter(
          (product) => product.checkout,
        );

        const isValidProduct = validProducts.some(
          (product) => product.stripeProductId === input.stripeProductId,
        );

        if (!isValidProduct) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid Stripe product ID",
          });
        }

        // Retrieve Stripe product
        const product = await stripeClient.products.retrieve(
          input.stripeProductId,
        );

        // Retrieve the default price and verify its type
        if (!product.default_price) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Product does not have a default price",
          });
        }

        const price = await stripeClient.prices.retrieve(
          product.default_price as string,
        );

        // Determine the checkout mode based on price type
        const checkoutMode =
          price.type === "recurring" ? "subscription" : "payment";

        // Use the custom email if provided, otherwise fall back to session email
        const customerEmail =
          input.customerEmail || ctx.session.user.email || "";

        // Create checkout session
        const returnUrl = `${env.NEXTAUTH_URL}/organization/${input.orgId}/settings/billing`;
        const sessionConfig: Stripe.Checkout.SessionCreateParams = {
          line_items: [
            {
              price: product.default_price as string,
              quantity: checkoutMode === "payment" ? 10 : 1,
              ...(checkoutMode === "payment"
                ? {
                    adjustable_quantity: {
                      enabled: true,
                      minimum: 10,
                      maximum: 1000,
                    },
                  }
                : {}),
            },
          ],
          client_reference_id:
            createStripeClientReference(input.orgId) ?? undefined,
          // Handle customer configuration for payment mode
          ...(checkoutMode === "payment"
            ? {
                // If we have an existing customer, use it
                ...(parsedOrg.cloudConfig?.stripe?.customerId
                  ? { customer: parsedOrg.cloudConfig.stripe.customerId }
                  : {
                      // Only create new customer if we don't have one
                      customer_creation: "if_required",
                      customer_email: customerEmail,
                    }),
              }
            : {
                customer_email: customerEmail,
              }),
          allow_promotion_codes: true,
          success_url: returnUrl,
          cancel_url: returnUrl,
          mode: checkoutMode,
          metadata: {
            orgId: input.orgId,
            cloudRegion: env.NEXT_PUBLIC_HANZO_CLOUD_REGION ?? null,
            productType: price.type,
          },
        };

        const session =
          await stripeClient.checkout.sessions.create(sessionConfig);

        // Audit logging
        auditLog({
          session: ctx.session,
          orgId: input.orgId,
          resourceType: "stripeCheckoutSession",
          resourceId: session.id,
          action: "create",
        });

        // Return the checkout URL along with a flag to indicate whether the session was created
        return {
          url: session.url,
          sessionId: session.id,
        };
      } catch (error) {
        // Log additional details about the error
        if (error instanceof Error) {
          console.error("Error Name:", error.name);
          console.error("Error Message:", error.message);
          console.error("Error Stack:", error.stack);
        }

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Unexpected error: ${error.message}`
              : "Unknown error occurred",
        });
      }
    }),
  changeStripeSubscriptionProduct: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        stripeProductId: z.string(),
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

      // check that product is valid
      if (
        !stripeProducts
          .filter((i) => Boolean(i.checkout))
          .map((i) => i.stripeProductId)
          .includes(input.stripeProductId)
      )
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invalid stripe product id, product not available",
        });

      const org = await ctx.prisma.organization.findUnique({
        where: {
          id: input.orgId,
        },
      });
      if (!org) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Organization not found",
        });
      }

      const parsedOrg = parseDbOrg(org);
      if (parsedOrg.cloudConfig?.plan)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Cannot change plan for orgs that have a manual/legacy plan",
        });

      const stripeSubscriptionId =
        parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;

      if (!stripeSubscriptionId)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Organization does not have an active subscription",
        });

      if (!stripeClient)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe client not initialized",
        });

      const subscription =
        await stripeClient.subscriptions.retrieve(stripeSubscriptionId);

      if (
        ["canceled", "paused", "incomplete", "incomplete_expired"].includes(
          subscription.status,
        )
      )
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Subscription is not active, current status: " +
            subscription.status,
        });

      if (subscription.items.data.length !== 1)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Subscription has multiple items",
        });

      const item = subscription.items.data[0];

      if (
        !stripeProducts
          .map((i) => i.stripeProductId)
          .includes(item.price.product as string)
      )
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Current subscription product is not a valid product",
        });

      const newProduct = await stripeClient.products.retrieve(
        input.stripeProductId,
      );
      if (!newProduct.default_price)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "New product does not have a default price in Stripe",
        });

      await stripeClient.subscriptions.update(stripeSubscriptionId, {
        items: [
          // remove current product from subscription
          {
            id: item.id,
            deleted: true,
          },
          // add new product to subscription
          {
            price: newProduct.default_price as string,
          },
        ],
        // reset billing cycle which causes immediate invoice for existing plan
        billing_cycle_anchor: "now",
        proration_behavior: "none",
      });
    }),
  getStripeCustomerPortalUrl: protectedOrganizationProcedure
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

      const org = await ctx.prisma.organization.findUnique({
        where: {
          id: input.orgId,
        },
      });
      if (!org) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Organization not found",
        });
      }

      if (!stripeClient)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe client not initialized",
        });

      const parsedOrg = parseDbOrg(org);
      let stripeCustomerId = parsedOrg.cloudConfig?.stripe?.customerId;

      // Fetch subscriptions separately

      let stripeSubscriptionId =
        parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;

      if (!stripeCustomerId || !stripeSubscriptionId) {
        // Do not create a new customer if the org is on a plan (assigned manually)
        return null;
      }

      const billingPortalSession =
        await stripeClient.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: `${env.NEXTAUTH_URL}/organization/${input.orgId}/settings/billing`,
        });

      return billingPortalSession.url;
    }),
  getUsage: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
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

        const organization = await ctx.prisma.organization.findUnique({
          where: {
            id: input.orgId,
          },
          include: {
            projects: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!organization) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Organization not found",
          });
        }

        const parsedOrg = parseDbOrg(organization);

        if (
          stripeClient &&
          parsedOrg.cloudConfig?.stripe?.customerId &&
          parsedOrg.cloudConfig?.stripe?.activeSubscriptionId
        ) {
          const subscription = await stripeClient.subscriptions.retrieve(
            parsedOrg.cloudConfig.stripe.activeSubscriptionId,
          );
          if (subscription) {
            const firstItem = subscription.items.data[0];
            const billingPeriod =
              firstItem?.current_period_start && firstItem?.current_period_end
                ? {
                    start: new Date(firstItem.current_period_start * 1000),
                    end: new Date(firstItem.current_period_end * 1000),
                  }
                : null;
            try {
              const stripeInvoice = await stripeClient.invoices.createPreview({
                subscription: parsedOrg.cloudConfig.stripe.activeSubscriptionId,
              });

              const upcomingInvoice = {
                usdAmount: stripeInvoice.amount_due / 100,
                date: new Date(stripeInvoice.period_end * 1000),
              };

              const usageInvoiceLines = stripeInvoice.lines.data.filter(
                (line: any) => Boolean(line.price?.recurring?.meter),
              );
              const usage = usageInvoiceLines.reduce(
                (acc: number, line: any) => {
                  if (line.quantity) {
                    return acc + line.quantity;
                  }
                  return acc;
                },
                0,
              );

              const meterId = (usageInvoiceLines[0] as any)?.price?.recurring
                ?.meter;
              const meter = meterId
                ? await stripeClient.billing.meters.retrieve(meterId)
                : undefined;
              // console.log("Meter details:", meter);

              return {
                usageCount: usage,
                usageType: meter?.display_name.toLowerCase() ?? "events",
                billingPeriod,
                upcomingInvoice,
              };
            } catch (e) {
              console.error(
                "Failed to get usage from Stripe, using usage from Clickhouse",
                {
                  error: e,
                },
              );
            }
          }
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        const projectIds = organization.projects.map((p) => p.id);
        console.log("Project IDs for usage calculation:", projectIds);

        const countObservations =
          await getObservationCountOfProjectsSinceCreationDate({
            projectIds,
            start: thirtyDaysAgo,
          });
        console.log("Count of observations:", countObservations);

        return {
          usageCount: countObservations,
          usageType: "observations",
        };
      } catch (error) {
        console.error("Error in getUsage function:", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Unexpected error: ${error.message}`
              : "Unknown error occurred",
        });
      }
    }),

  getSubscription: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (!stripeClient) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe client not initialized",
        });
      }

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
      const stripeCustomerId = parsedOrg.cloudConfig?.stripe?.customerId;

      // If no Stripe customer ID, return null
      if (!stripeCustomerId) {
        console.warn(
          `No Stripe customer ID found for organization ${input.orgId}`,
        );
        return null;
      }

      try {
        // Fetch subscriptions that are still relevant (active, past_due, or scheduled to cancel)
        const subscriptionsResponse = await stripeClient.subscriptions.list({
          limit: 1,
          expand: ["data"],
          customer: stripeCustomerId,
          status: "active",
        });

        // No subscriptions found
        if (!subscriptionsResponse.data.length) {
          console.info(
            `No subscriptions found for customer ${stripeCustomerId}`,
          );
          return null;
        }

        // Get the most recent subscription
        const latestSubscription = subscriptionsResponse.data[0];
        const firstItem = latestSubscription.items.data[0];
        const productId = firstItem?.price?.product as string;

        // Retrieve product details separately
        const productDetails = await stripeClient.products.retrieve(productId);

        return {
          id: latestSubscription.id,
          status: latestSubscription.status,
          current_period_start: firstItem?.current_period_start
            ? new Date(firstItem.current_period_start * 1000)
            : null,
          current_period_end: firstItem?.current_period_end
            ? new Date(firstItem.current_period_end * 1000)
            : null,
          cancel_at: latestSubscription.cancel_at
            ? new Date(latestSubscription.cancel_at * 1000)
            : null,
          canceled_at: latestSubscription.canceled_at
            ? new Date(latestSubscription.canceled_at * 1000)
            : null,
          plan: {
            name: productDetails.name || "Unknown Plan",
            description:
              productDetails.description || "No description available",
            id: productId,
          },
          price: {
            amount: firstItem?.price?.unit_amount
              ? firstItem.price.unit_amount / 100
              : null,
            currency: firstItem?.price?.currency,
          },
        };
      } catch (error) {
        console.error(
          `Error retrieving subscription for organization ${input.orgId}:`,
          error,
        );
        return null;
      }
    }),

  // New method to save subscription data
  saveSubscriptionData: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        stripeSubscriptionId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        organizationId: input.orgId,
        scope: "hanzoCloudBilling:CRUD",
        session: ctx.session,
      });

      if (!stripeClient) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe client not initialized",
        });
      }

      try {
        // Retrieve the full subscription details
        const subscription = await stripeClient.subscriptions.retrieve(
          input.stripeSubscriptionId,
        );

        // Ensure we have a single price/product
        if (subscription.items.data.length !== 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Subscription must have exactly one product",
          });
        }

        const subscriptionItem = subscription.items.data[0];
        const productId = subscriptionItem.price.product as string;
        const priceId = subscriptionItem.price.id;

        // Update organization's cloud config with subscription details
        const org = await ctx.prisma.organization.findUnique({
          where: { id: input.orgId },
        });

        if (!org) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
          });
        }

        // Prepare updated cloud config
        const updatedCloudConfig = org.cloudConfig
          ? {
              ...JSON.parse(JSON.stringify(org.cloudConfig)),
              stripe: {
                ...((org.cloudConfig as any)?.stripe || {}),
                activeSubscriptionId: input.stripeSubscriptionId,
                activeProductId: productId,
                activePriceId: priceId,
                subscriptionStatus: subscription.status,
                currentPeriodStart: subscriptionItem.current_period_start
                  ? new Date(subscriptionItem.current_period_start * 1000)
                  : null,
                currentPeriodEnd: subscriptionItem.current_period_end
                  ? new Date(subscriptionItem.current_period_end * 1000)
                  : null,
              },
            }
          : {
              stripe: {
                activeSubscriptionId: input.stripeSubscriptionId,
                activeProductId: productId,
                activePriceId: priceId,
                subscriptionStatus: subscription.status,
                currentPeriodStart: subscriptionItem.current_period_start
                  ? new Date(subscriptionItem.current_period_start * 1000)
                  : null,
                currentPeriodEnd: subscriptionItem.current_period_end
                  ? new Date(subscriptionItem.current_period_end * 1000)
                  : null,
              },
            };

        // Create or update StripeSubscription record

        // Update organization with new cloud config
        await ctx.prisma.organization.update({
          where: { id: input.orgId },
          data: {
            cloudConfig: updatedCloudConfig,
          },
        });

        // Audit log the subscription save
        auditLog({
          session: ctx.session,
          orgId: input.orgId,
          resourceType: "stripeCheckoutSession",
          resourceId: input.stripeSubscriptionId,
          action: "create",
        });

        return {
          success: true,
          subscriptionId: input.stripeSubscriptionId,
          // plan: subscription.items.data[0].price.product. ,
        };
      } catch (error) {
        console.error("Error saving subscription data:", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Failed to save subscription: ${error.message}`
              : "Unknown error occurred while saving subscription",
        });
      }
    }),

  // New method to get subscription history
  getSubscriptionHistory: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        limit: z.number().optional().default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (!stripeClient) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe client not initialized",
        });
      }

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
      const stripeCustomerId = parsedOrg.cloudConfig?.stripe?.customerId;

      if (!stripeCustomerId) {
        return {
          subscriptions: [],
          hasMore: false,
        };
      }

      try {
        // Retrieve subscription history from Stripe
        const subscriptionsResponse = await stripeClient.subscriptions.list({
          customer: stripeCustomerId,
          limit: input.limit,
          expand: ["data.latest_invoice", "data.items.data.price"],
        });

        // Fetch all unique product details first
        const productIds = new Set(
          subscriptionsResponse.data
            .map((subscription) => subscription.items.data[0]?.price?.product)
            .filter(Boolean) as string[],
        );

        const productDetailsMap = new Map<string, string>();
        for (const productId of productIds) {
          try {
            const product = await stripeClient.products.retrieve(productId);
            productDetailsMap.set(productId, product.name || "Unknown Plan");
          } catch (error) {
            console.error(`Failed to retrieve product ${productId}:`, error);
            productDetailsMap.set(productId, "Unknown Plan");
          }
        }
        // Then use the map when transforming subscriptions
        const subscriptionHistory = subscriptionsResponse.data.map(
          (subscription) => {
            const firstItem = subscription.items.data[0];
            const productId = firstItem?.price?.product as string;
            const billingPeriod =
              firstItem?.current_period_start && firstItem?.current_period_end
                ? {
                    start: new Date(firstItem.current_period_start * 1000),
                    end: new Date(firstItem.current_period_end * 1000),
                  }
                : null;
            return {
              id: subscription.id,
              status: subscription.status,
              plan: {
                name: productDetailsMap.get(productId) || "Unknown Plan",
                amount: firstItem?.price?.unit_amount
                  ? firstItem.price.unit_amount / 100
                  : 0,
                billingPeriod: billingPeriod,
              },
              latestInvoice: subscription.latest_invoice
                ? {
                    id: (subscription.latest_invoice as Stripe.Invoice).id,
                    amountDue:
                      (subscription.latest_invoice as Stripe.Invoice)
                        .amount_due / 100,
                    status: (subscription.latest_invoice as Stripe.Invoice)
                      .status,
                    number:
                      (subscription.latest_invoice as Stripe.Invoice).number ||
                      "N/A",
                    pdfUrl:
                      (subscription.latest_invoice as Stripe.Invoice)
                        .invoice_pdf || null,
                  }
                : null,
            };
          },
        );

        return {
          subscriptions: subscriptionHistory,
          hasMore: subscriptionsResponse.has_more,
        };
      } catch (error) {
        console.error("Error retrieving subscription history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve subscription history",
        });
      }
    }),

  getInvoicePdfUrl: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        invoiceId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (!stripeClient) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe client not initialized",
        });
      }

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
      const stripeCustomerId = parsedOrg.cloudConfig?.stripe?.customerId;

      if (!stripeCustomerId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No Stripe customer associated with this organization",
        });
      }

      try {
        // Retrieve the invoice
        const invoice = await stripeClient.invoices.retrieve(input.invoiceId);

        // Ensure the invoice belongs to the customer
        if (invoice.customer !== stripeCustomerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Invoice does not belong to this organization",
          });
        }

        // Check if invoice has a PDF
        if (!invoice.invoice_pdf) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No PDF available for this invoice",
          });
        }

        return {
          pdfUrl: invoice.invoice_pdf,
          invoiceNumber: invoice.number || "Unknown",
          amountDue: invoice.amount_due / 100,
          invoiceDate: new Date(invoice.created * 1000),
        };
      } catch (error) {
        console.error(
          `Error retrieving invoice PDF for ${input.invoiceId}:`,
          error,
        );

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve invoice PDF",
        });
      }
    }),

  cancelStripeSubscription: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        stripeProductId: z.string(),
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

      if (!stripeClient) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe client not initialized",
        });
      }

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

      // Try to get the active subscription ID from cloud config
      let stripeSubscriptionId =
        parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;

      // If no active subscription ID, try to fetch the latest active subscription
      if (!stripeSubscriptionId) {
        const stripeCustomerId = parsedOrg.cloudConfig?.stripe?.customerId;

        if (!stripeCustomerId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No Stripe customer found for this organization",
          });
        }

        // Fetch active subscriptions for this customer
        const subscriptionsResponse = await stripeClient.subscriptions.list({
          customer: stripeCustomerId,
          status: "active",
          limit: 1,
        });

        if (subscriptionsResponse.data.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No active subscriptions found",
          });
        }

        stripeSubscriptionId = subscriptionsResponse.data[0].id;
      }

      try {
        // Retrieve the current subscription to validate
        const currentSubscription =
          await stripeClient.subscriptions.retrieve(stripeSubscriptionId);

        // Validate that the current subscription matches the product being canceled
        const currentProductId =
          currentSubscription.items.data[0]?.price?.product;

        if (currentProductId !== input.stripeProductId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Subscription product does not match the requested cancellation",
          });
        }

        // Cancel the subscription at the end of the current billing period
        const canceledSubscription = await stripeClient.subscriptions.update(
          stripeSubscriptionId,
          {
            cancel_at_period_end: true,
          },
        );

        // Audit log the subscription cancellation
        auditLog({
          session: ctx.session,
          orgId: input.orgId,
          resourceType: "organization",
          resourceId: stripeSubscriptionId,
          action: "cancel",
        });

        return {
          success: true,
          message:
            "Subscription will be canceled at the end of the current billing period",
          cancelAt: canceledSubscription.cancel_at
            ? new Date(canceledSubscription.cancel_at * 1000)
            : null,
        };
      } catch (error) {
        console.error("Full Error in cancelStripeSubscription:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Unexpected error: ${error.message}`
              : "Unknown error occurred",
        });
      }
    }),
});
