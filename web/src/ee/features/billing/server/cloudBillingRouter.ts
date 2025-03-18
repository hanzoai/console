import { createStripeClientReference } from "@/src/ee/features/billing/stripeClientReference";
import { stripeClient } from "@/src/ee/features/billing/utils/stripe";
import { stripeProducts } from "@/src/ee/features/billing/utils/stripeProducts";
import { env } from "@/src/env.mjs";
import { throwIfNoEntitlement } from "@/src/features/entitlements/server/hasEntitlement";
import { parseDbOrg } from "@langfuse/shared";
import {
  createTRPCRouter,
  protectedOrganizationProcedure,
} from "@/src/server/api/trpc";
import { TRPCError } from "@trpc/server";
import * as z from "zod";
import { throwIfNoOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { auditLog } from "@/src/features/audit-logs/auditLog";
import {
  getObservationCountOfProjectsSinceCreationDate,
} from "@langfuse/shared/src/server";
import { Organization, PrismaClient } from "@prisma/client";
import Stripe from "stripe";

export const cloudBillingRouter = createTRPCRouter({
  createStripeCheckoutSession: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        stripeProductId: z.string(),
        customerEmail: z.string().email().optional(),
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
        const validProducts = stripeProducts.filter(product => product.checkout);

        const isValidProduct = validProducts.some(
          product => product.stripeProductId === input.stripeProductId
        );
        
        if (!isValidProduct) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid Stripe product ID",
          });
        }

        // Retrieve Stripe product
        const product = await stripeClient.products.retrieve(input.stripeProductId);

        // Retrieve the default price and verify its type
        if (!product.default_price) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Product does not have a default price",
          });
        }

        const price = await stripeClient.prices.retrieve(product.default_price as string);

        // Determine the checkout mode based on price type
        const checkoutMode = price.type === 'recurring' 
          ? 'subscription' 
          : 'payment';
          console.log("checkoutMode==========sdfafasdf===", checkoutMode);
        // Determine customer ID
        const stripeCustomerId = 
          parsedOrg.cloudConfig?.stripe?.customerId || 
          await createStripeCustomerForOrg(ctx.prisma, org);

        // Use the custom email if provided, otherwise fall back to session email
        const customerEmail = input.customerEmail || ctx.session.user.email;

        // Create checkout session
        const returnUrl = `${env.NEXTAUTH_URL}/organization/${input.orgId}/settings/billing`;
        const sessionConfig: Stripe.Checkout.SessionCreateParams = {
          line_items: [
            {
              price: product.default_price as string,
              quantity: 1,
            },
          ],
          client_reference_id: createStripeClientReference(input.orgId) ?? undefined,
          allow_promotion_codes: true,
          success_url: returnUrl,
          cancel_url: returnUrl,
          mode: checkoutMode,
          metadata: {
            orgId: input.orgId,
            cloudRegion: env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION ?? null,
            userEmail: ctx.session.user.email || '',
            productType: price.type,
          },
        };

        // Conditionally add customer or customer_email
        if (stripeCustomerId) {
          sessionConfig.customer = stripeCustomerId;
        } else if (customerEmail) {
          sessionConfig.customer_email = customerEmail;
        }


        const session = await stripeClient.checkout.sessions.create(sessionConfig);

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
          message: error instanceof Error 
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
        parsedOrg.cloudConfig?.stripe?.activeSubscriptionId

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
            const billingPeriod = subscription.current_period_start && subscription.current_period_end
              ? {
                  start: new Date(subscription.current_period_start * 1000),
                  end: new Date(subscription.current_period_end * 1000),
                }
              : null;
            try {
              const stripeInvoice = await stripeClient.invoices.retrieveUpcoming({
                subscription: parsedOrg.cloudConfig.stripe.activeSubscriptionId,
              });

              const upcomingInvoice = {
                usdAmount: stripeInvoice.amount_due / 100,
                date: new Date(stripeInvoice.period_end * 1000),
              };

              const usageInvoiceLines = stripeInvoice.lines.data.filter((line) =>
                Boolean(line.plan?.meter),
              );
              const usage = usageInvoiceLines.reduce((acc, line) => {
                if (line.quantity) {
                  return acc + line.quantity;
                }
                return acc;
              }, 0);

              const meterId = usageInvoiceLines[0]?.plan?.meter;
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
          message: error instanceof Error 
            ? `Unexpected error: ${error.message}` 
            : "Unknown error occurred",
        });
      }
    }),

  getSubscription: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
      })
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
        console.warn(`No Stripe customer ID found for organization ${input.orgId}`);
        return null;
      }

      try {
        // Fetch subscriptions that are still relevant (active, past_due, or scheduled to cancel)
        const subscriptionsResponse = await stripeClient.subscriptions.list({
          limit: 1,
          expand: ['data'],
          customer: stripeCustomerId,
          status: 'active',
        });

        // No subscriptions found
        if (!subscriptionsResponse.data.length) {
          console.info(`No subscriptions found for customer ${stripeCustomerId}`);
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
          current_period_start: new Date(latestSubscription.current_period_start * 1000),
          current_period_end: new Date(latestSubscription.current_period_end * 1000),
          
          plan: {
            name: productDetails.name || 'Unknown Plan',
            description: productDetails.description || 'No description available',
            id: productId,
          },
          
          price: {
            amount: firstItem?.price?.unit_amount ? firstItem.price.unit_amount / 100 : null,
            currency: firstItem?.price?.currency,
          },
        };
      } catch (error) {
        console.error(`Error retrieving subscription for organization ${input.orgId}:`, error);
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
          input.stripeSubscriptionId
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

        // Find the corresponding product from our predefined list
        const matchedProduct = stripeProducts.find(
          product => product.stripeProductId === productId
        );

        if (!matchedProduct) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Unrecognized Stripe product",
          });
        }

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
                ...(org.cloudConfig as any)?.stripe || {},
                activeSubscriptionId: input.stripeSubscriptionId,
                activeProductId: productId,
                activePriceId: priceId,
                subscriptionStatus: subscription.status,
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              },
            }
          : {
              stripe: {
                activeSubscriptionId: input.stripeSubscriptionId,
                activeProductId: productId,
                activePriceId: priceId,
                subscriptionStatus: subscription.status,
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
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
          plan: matchedProduct.name,
        };
      } catch (error) {
        console.error("Error saving subscription data:", error);
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error 
            ? `Failed to save subscription: ${error.message}` 
            : "Unknown error occurred while saving subscription",
        });
      }
    }),

  // New method to save subscription data
  saveCheckoutSessionSubscription: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        checkoutSessionId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!stripeClient) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe client not initialized",
        });
      }

      try {
        // Retrieve the checkout session with expanded line items and customer
        const session = await stripeClient.checkout.sessions.retrieve(
          input.checkoutSessionId,
          { expand: ['line_items', 'customer', 'subscription'] }
        );

        console.log("session==========sdfafasdf===", session);

        // Validate the session
        if (session.client_reference_id !== input.orgId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Checkout session does not match organization",
          });
        }

        // Create or get Stripe customer
        
              // Handle different session modes
        if (session.mode === 'payment') {
          // Credit purchase logic
          const amountPaid = session.amount_total ? session.amount_total / 100 : 0;
          console.log("amountPaid==========sdfafasdf===", amountPaid);
          
          // Update organization credits in a transaction
          const [updatedOrg] = await ctx.prisma.$transaction(async (tx) => {
            const org = await tx.organization.update({
              where: { id: input.orgId },
              data: {              
                credits: {
                  increment: amountPaid
                }                
              },              
            });

            const record = await tx.usageRecord.create({
              data: {
                organizationId: input.orgId,
                usageMeterId: await findOrCreateCreditMeter(tx, input.orgId),
                value: amountPaid,
                metadata: {
                  checkoutSessionId: input.checkoutSessionId,
                  type: 'CREDIT_PURCHASE',
                },
              },
            });

            return [org, record];
          });

          

          const credits = (updatedOrg.cloudConfig as any)?.credits || 0;

          return {
            success: true,
            type: 'credit_purchase',
            creditsPurchased: amountPaid,
            totalCredits: credits,
          };
        }

        if (session.mode === 'subscription') {
          // Subscription purchase logic
          if (!session.subscription || typeof session.subscription !== 'string') {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "No subscription found in checkout session",
            });
          }

          // Retrieve full subscription details
          const subscription = await stripeClient.subscriptions.retrieve(
            session.subscription
          );

          // Determine product and plan details
          const firstItem = subscription.items.data[0];
          const productId = firstItem?.price?.product as string;
          const product = await stripeClient.products.retrieve(productId);

          // Create subscription record and update organization in a transaction
      

          // Update checkout session with subscription
          return {
            success: true,
            type: 'subscription',
            plan: product.name,
          };
        }

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unhandled checkout session mode",
        });
      } catch (error) {
        console.error("Error saving checkout session:", error);
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error 
            ? `Failed to save checkout session: ${error.message}` 
            : "Unexpected error processing checkout session",
        });
      }
    }),

  // New method to get subscription history
  getSubscriptionHistory: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        limit: z.number().optional().default(10),
      })
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
          hasMore: false 
        };
      }

      try {
        // Retrieve subscription history from Stripe
        const subscriptionsResponse = await stripeClient.subscriptions.list({
          customer: stripeCustomerId,
          limit: input.limit,
          expand: ['data.latest_invoice', 'data.items.data.price'],
        });

        // Fetch all unique product details first
        const productIds = new Set(
          subscriptionsResponse.data
            .map(subscription => subscription.items.data[0]?.price?.product)
            .filter(Boolean) as string[]
        );

        const productDetailsMap = new Map<string, string>();
        for (const productId of productIds) {
          try {
            const product = await stripeClient.products.retrieve(productId);
            productDetailsMap.set(productId, product.name || 'Unknown Plan');
          } catch (error) {
            console.error(`Failed to retrieve product ${productId}:`, error);
            productDetailsMap.set(productId, 'Unknown Plan');
          }
        }
        // Then use the map when transforming subscriptions
        const subscriptionHistory = subscriptionsResponse.data.map(subscription => {
          const firstItem = subscription.items.data[0];
          const productId = firstItem?.price?.product as string;
          const billingPeriod = subscription.current_period_start && subscription.current_period_end
            ? {
              start: new Date(subscription.current_period_start * 1000),
              end: new Date(subscription.current_period_end * 1000),
             }
            : null;
          return {
            id: subscription.id,
            status: subscription.status,
            plan: {
              name: productDetailsMap.get(productId) || 'Unknown Plan',
              amount: firstItem?.price?.unit_amount ? firstItem.price.unit_amount / 100 : 0,
              billingPeriod: billingPeriod,
            },
            latestInvoice: subscription.latest_invoice ? {
              id: (subscription.latest_invoice as Stripe.Invoice).id,
              amountDue: (subscription.latest_invoice as Stripe.Invoice).amount_due / 100,
              status: (subscription.latest_invoice as Stripe.Invoice).status,
              number: (subscription.latest_invoice as Stripe.Invoice).number || 'N/A',
              pdfUrl: (subscription.latest_invoice as Stripe.Invoice).invoice_pdf || null,
            } : null,
          };
        });

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
      })
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
          invoiceNumber: invoice.number || 'Unknown',
          amountDue: invoice.amount_due / 100,
          invoiceDate: new Date(invoice.created * 1000),
        };
      } catch (error) {
        console.error(`Error retrieving invoice PDF for ${input.invoiceId}:`, error);
        
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
          status: 'active',
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
        const currentSubscription = await stripeClient.subscriptions.retrieve(
          stripeSubscriptionId
        );

        // Validate that the current subscription matches the product being canceled
        const currentProductId = currentSubscription.items.data[0]?.price?.product;


        if (currentProductId !== input.stripeProductId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Subscription product does not match the requested cancellation",
          });
        }

        // Cancel the subscription at the end of the current billing period
        const canceledSubscription = await stripeClient.subscriptions.update(
          stripeSubscriptionId,
          {
            cancel_at_period_end: true,
          }
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
          message: "Subscription will be canceled at the end of the current billing period",
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
          message: error instanceof Error 
            ? `Unexpected error: ${error.message}` 
            : "Unknown error occurred",
        });
      }
    }),
});

// Utility function to create Stripe customer if not exists
async function createStripeCustomerForOrg(prisma: PrismaClient, org: Organization) {
  if (!stripeClient) {
    throw new Error("Stripe client not initialized");
  }

  const customer = await stripeClient.customers.create({
    name: org.name || undefined,
    metadata: {
      orgId: org.id,
    },
  });

  // Safely handle cloudConfig
  const updatedCloudConfig = org.cloudConfig 
    ? { 
        ...org.cloudConfig as Record<string, unknown>, 
        stripe: {
          ...(org.cloudConfig as any)?.stripe || {},
          customerId: customer.id,
        } 
      }
    : { 
        stripe: { 
          customerId: customer.id 
        } 
      };

  // Update organization with new customer ID
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      cloudConfig: updatedCloudConfig,
      credits: 5,
    },
  });

  return customer.id;
}

// Modify the findOrCreateCreditMeter function to accept a Prisma transaction
async function findOrCreateCreditMeter(prisma: any, orgId: string) {
  const existingMeter = await prisma.usageMeter.findFirst({
    where: {
      organizationId: orgId,
      name: 'Credits',
      type: 'AI',
    },
  });

  if (existingMeter) return existingMeter.id;

  const newMeter = await prisma.usageMeter.create({
    data: {
      organizationId: orgId,
      name: 'Credits',
      type: 'AI',
      unit: 'USD',
      aggregationMethod: 'LAST',
    },
  });

  return newMeter.id;
}