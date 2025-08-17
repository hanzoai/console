import { env } from "@/src/env.mjs";
import {
  getOrgIdFromStripeClientReference,
  isStripeClientReferenceFromCurrentCloudRegion,
} from "@/src/features/billing/stripeClientReference";
import { stripeClient } from "@/src/features/billing/utils/stripe";
import { mapStripeProductIdToPlan } from "@/src/features/billing/utils/stripeProducts";
import { ApiAuthService } from "@/src/features/public-api/server/apiAuth";
import { CloudConfigSchema, parseDbOrg } from "@hanzo/shared";
import { prisma } from "@hanzo/shared/src/db";
import { logger, redis, traceException } from "@hanzo/shared/src/server";
import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { serverBillingAnalytics } from "@/src/features/billing/server/analytics";

/*
 * Sign-up endpoint (email/password users), creates user in database.
 * SSO users are created by the NextAuth adapters.
 */
export async function stripeWebhookApiHandler(req: NextRequest) {
  if (req.method !== "POST")
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );

  if (!env.NEXT_PUBLIC_HANZO_CLOUD_REGION || !stripeClient) {
    logger.error(
      "[Stripe Webhook] Endpoint only available in HanzoCloudud Cloud",
    );
    return NextResponse.json(
      { message: "Stripe webhook endpoint only available in Hanzo Cloud" },
      { status: 500 },
    );
  }
  if (!env.STRIPE_WEBHOOK_SIGNING_SECRET) {
    logger.error("[Stripe Webhook] Stripe webhook signing key not found");
    return NextResponse.json(
      { message: "Stripe secret key not found" },
      { status: 500 },
    );
  }

  // Read the request body once and store it in a variable
  let rawBody: string;
  try {
    rawBody = await req.text();
    if (!rawBody) {
      logger.error("[Stripe Webhook] Empty request body");
      return NextResponse.json(
        { message: "Empty request body" },
        { status: 400 },
      );
    }
    logger.debug("[Stripe Webhook] Received raw body", {
      length: rawBody.length,
    });
  } catch (error) {
    logger.error("[Stripe Webhook] Error reading request body", error);
    return NextResponse.json(
      { message: "Error reading request body" },
      { status: 400 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    logger.error("[Stripe Webhook] No signature");
    return NextResponse.json({ message: "No signature" }, { status: 400 });
  }
  let event: Stripe.Event;
  try {
    event = stripeClient.webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SIGNING_SECRET,
    );
  } catch (err) {
    logger.error("[Stripe Webhook] Error verifying signature", err);
    return NextResponse.json(
      { message: `Webhook Error: ${err}` },
      { status: 400 },
    );
  }

  // Handle the event
  switch (event.type) {
    case "customer.subscription.created":
      // update the active product id on the organization linked to the subscription + customer and subscription id (if null or same)
      const subscription = event.data.object;
      console.log("Check Subscription :>>>", subscription);
      logger.info("[Stripe Webhook] Start customer.subscription.created", {
        payload: subscription,
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
        items: subscription.items.data,
      });
      await handleSubscriptionChanged(subscription, "created");
      break;
    case "customer.subscription.updated":
    case "invoice.updated":
      // update the active product id on the organization linked to the subscription + customer and subscription id (if null or same)
      const updatedSubscription = event.data.object as Stripe.Subscription;
      logger.info("[Stripe Webhook] Start customer.subscription.updated", {
        payload: updatedSubscription,
        subscriptionId: updatedSubscription.id,
        customerId: updatedSubscription.customer,
        status: updatedSubscription.status,
        items: updatedSubscription.items.data,
      });
      await handleSubscriptionChanged(updatedSubscription, "updated");
      break;
    case "customer.subscription.deleted":
      // remove the active product id on the organization linked to the subscription + subscription, keep customer id
      const deletedSubscription = event.data.object;
      logger.info("[Stripe Webhook] Start customer.subscription.deleted", {
        payload: deletedSubscription,
        subscriptionId: deletedSubscription.id,
        customerId: deletedSubscription.customer,
        status: deletedSubscription.status,
      });
      await handleSubscriptionChanged(deletedSubscription, "deleted");
      break;
    case "payment_intent.succeeded":
    case "checkout.session.completed":
    case "invoice.payment_succeeded":
      // Add handling for credit purchases
      const paymentObject = event.data.object as Stripe.PaymentIntent | Stripe.Checkout.Session;
      console.log("paymentObject=============", paymentObject);
      logger.info("[Stripe Webhook] Start payment.succeeded", {
        payload: paymentObject,
      });
      await handleCreditPurchase(paymentObject);
      break;
    default:
      logger.warn(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleSubscriptionChanged(
  subscription: Stripe.Subscription,
  action: "created" | "deleted" | "updated",
) {
  const subscriptionId = subscription.id;
  logger.info("[Stripe Webhook] Processing subscription:", {
    subscriptionId,
    subscription,
    action,
    status: subscription.status,
    customerId: subscription.customer,
  });

  // get the checkout session from the subscription to retrieve the client reference for this subscription
  const checkoutSessionsResponse = await stripeClient?.checkout.sessions.list({
    subscription: subscriptionId,
    limit: 1,
  });

  logger.info("[Stripe Webhook] Found checkout sessions:", {
    count: checkoutSessionsResponse?.data.length,
    sessions: checkoutSessionsResponse?.data,
  });

  if (!checkoutSessionsResponse || checkoutSessionsResponse.data.length !== 1) {
    logger.error("[Stripe Webhook] No checkout session found", {
      subscriptionId,
      sessions: checkoutSessionsResponse?.data,
    });
    traceException("[Stripe Webhook] No checkout session found");
    return;
  }
  const checkoutSession = checkoutSessionsResponse.data[0];

  // the client reference is passed to the stripe checkout session via the pricing page
  const clientReference = checkoutSession.client_reference_id;
  if (!clientReference) {
    logger.error("[Stripe Webhook] No client reference", {
      checkoutSession,
      subscriptionId,
    });
    traceException("[Stripe Webhook] No client reference");
    return NextResponse.json(
      { message: "No client reference" },
      { status: 400 },
    );
  }
  if (!isStripeClientReferenceFromCurrentCloudRegion(clientReference)) {
    logger.info(
      "[Stripe Webhook] Client reference not from current cloud region",
      { clientReference },
    );
    return;
  }
  const orgId = getOrgIdFromStripeClientReference(clientReference);

  // find the org with the customer ID
  const organization = await prisma.organization.findUnique({
    where: {
      id: orgId,
    },
  });

  logger.info("[Stripe Webhook] Found organization:", {
    organization,
    orgId,
  });

  if (!organization) {
    logger.error("[Stripe Webhook] Organization not found", { orgId });
    traceException("[Stripe Webhook] Organization not found");
    return;
  }
  const parsedOrg = parseDbOrg(organization);

  // assert that no other stripe customer id is already set on the org
  const customerId = subscription.customer;
  if (!customerId || typeof customerId !== "string") {
    logger.error("[Stripe Webhook] Customer ID not found", {
      customerId,
      subscriptionId,
    });
    traceException("[Stripe Webhook] Customer ID not found");
    return;
  }

  // check subscription items
  if (!subscription.items.data || subscription.items.data.length !== 1) {
    logger.error(
      "[Stripe Webhook] Subscription items not found or more than one",
      { items: subscription.items.data },
    );
    traceException(
      "[Stripe Webhook] Subscription items not found or more than one",
    );
    return;
  }

  const subscriptionItem = subscription.items.data[0];
  const productId = subscriptionItem.price.product;

  if (!productId || typeof productId !== "string") {
    logger.error("[Stripe Webhook] Product ID not found", {
      productId,
      subscriptionItem,
    });
    traceException("[Stripe Webhook] Product ID not found");
    return;
  }

  // Get the plan name from the product ID
  const planName = mapStripeProductIdToPlan(productId);
  if (!planName) {
    logger.error("[Stripe Webhook] Could not map product ID to plan name", {
      productId,
      subscriptionItem,
    });
    traceException("[Stripe Webhook] Could not map product ID to plan name");
    return;
  }

  logger.info("[Stripe Webhook] Updating organization plan:", {
    orgId,
    planName,
    productId,
    subscriptionId,
    customerId,
  });
  console.log("Check Parorg:>>>", parsedOrg);

  try {
    // update the cloud config with the product ID
    if (action === "created" || action === "updated") {
      const updatedOrg = await prisma.organization.update({
        where: {
          id: parsedOrg.id,
        },
        data: {
          cloudConfig: {
            ...parsedOrg.cloudConfig,
            stripe: {
              ...parsedOrg.cloudConfig?.stripe,
              ...CloudConfigSchema.shape.stripe.parse({
                activeProductId: productId,
                activeSubscriptionId: subscriptionId,
                customerId: customerId,
                subscriptionStatus: subscription.status,
              }),
            },
            plan: planName,
          },
        },
      });

      logger.info("[Stripe Webhook] Successfully updated organization plan", {
        updatedOrg,
        planName,
      });

      // Track analytics event
      if (action === "created") {
        await serverBillingAnalytics.subscriptionCreated({
          orgId: parsedOrg.id,
          planName,
          stripeProductId: productId,
          amount: subscriptionItem.price.unit_amount || 0,
          interval: subscriptionItem.price.recurring?.interval,
          status: subscription.status,
        });
      } else if (action === "updated") {
        await serverBillingAnalytics.subscriptionUpdated({
          orgId: parsedOrg.id,
          oldPlan: parsedOrg.cloudConfig?.plan || "free",
          newPlan: planName,
          stripeProductId: productId,
          status: subscription.status,
        });
      }
    } else if (action === "deleted") {
      const updatedOrg = await prisma.organization.update({
        where: {
          id: parsedOrg.id,
        },
        data: {
          cloudConfig: {
            ...parsedOrg.cloudConfig,
            stripe: {
              ...parsedOrg.cloudConfig?.stripe,
              activeProductId: null,
              activeSubscriptionId: null,
              subscriptionStatus: "canceled",
            },
            plan: "free",
          },
        },
      });

      logger.info("[Stripe Webhook] Successfully removed organization plan", {
        updatedOrg,
      });

      // Track analytics event
      await serverBillingAnalytics.subscriptionDeleted({
        orgId: parsedOrg.id,
        planName: parsedOrg.cloudConfig?.plan,
        stripeProductId: parsedOrg.cloudConfig?.stripe?.activeProductId || undefined,
      });
    }
    // commnet

    // need to update the plan in the api keys
    await new ApiAuthService(prisma, redis).invalidateOrgApiKeys(parsedOrg.id);
    logger.info("[Stripe Webhook] Successfully invalidated API keys", {
      orgId: parsedOrg.id,
    });
  } catch (error) {
    logger.error("[Stripe Webhook] Error updating organization", {
      error,
      orgId,
      planName,
      action,
    });
    traceException("[Stripe Webhook] Error updating organization");
    throw error;
  }

  return;
}

async function handleCreditPurchase(
  payment: Stripe.PaymentIntent | Stripe.Checkout.Session,
) {
  // Extract the amount paid and organization ID from the payment metadata
  const amountPaid =
    "amount_received" in payment
      ? payment.amount_received
      : (payment as Stripe.Checkout.Session).amount_total;

  const orgId = payment.metadata?.orgId;

  if (!orgId) {
    logger.error("[Stripe Webhook] No organization ID in payment metadata");
    return;
  }

  if (!amountPaid) {
    logger.error("[Stripe Webhook] No amount paid found in payment");
    return;
  }

  // Update the organization's credits
  const creditsAdded = amountPaid / 100;
  await prisma.organization.update({
    where: {
      id: orgId,
    },
    data: {
      credits: {
        increment: creditsAdded,
      },
    },
  });

  // Track analytics events
  await serverBillingAnalytics.paymentSucceeded({
    orgId,
    amount: amountPaid,
    currency: "amount_received" in payment ? payment.currency : (payment as Stripe.Checkout.Session).currency || "usd",
    type: "credit",
  });

  await serverBillingAnalytics.creditsAdded({
    orgId,
    amount: amountPaid,
    credits: creditsAdded,
  });
}
