import { stripeClient } from "@/src/features/billing/utils/stripe";
import { parseDbOrg } from "@hanzo/shared";
import { prisma } from "@hanzo/shared/src/db";
import { logger } from "@hanzo/shared/src/server";

/**
 * Update the slot (quantity) of a Stripe subscription item for an organization.
 * @param orgId - Organization ID
 * @param stripeProductId - Stripe Product ID
 * @param slotCount - New slot count (quantity)
 */
export async function updateStripeSlot(orgId: string, stripeProductId: string, slotCount: number) {
  // Get organization and parse config
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organization not found");
  const parsedOrg = parseDbOrg(org);
  const subscriptionId = parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;
  if (!subscriptionId) throw new Error("No active Stripe subscription for this org");
  if (!stripeClient) throw new Error("Stripe client not initialized");

  // Get subscription from Stripe
  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data.find(
    (i) => i.price.product === stripeProductId
  );
  if (!item) throw new Error("No subscription item found for this product");

  // Update the quantity (slot count) on Stripe
  await stripeClient.subscriptionItems.update(item.id, {
    quantity: slotCount,
    // Optionally, you can set proration_behavior if needed
    // proration_behavior: "create_prorations",
  });

  return true;
}

/**
 * Increase the slot (quantity) of a Stripe subscription item for an organization by 1.
 * @param orgId - Organization ID
 * @param stripeProductId - Stripe Product ID
 */
export async function increaseStripeSlot(orgId: string) {
  // Get organization and parse config
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    logger.error("Organization not found", { orgId });
    return false
  }
  const parsedOrg = parseDbOrg(org);
  console.log("Parsed Organization:", parsedOrg);
  if (!parsedOrg.cloudConfig?.stripe) {
    logger.error("Stripe configuration not found in organization", { orgId });
    return false
  }
  if (!stripeClient) throw new Error("Stripe client not initialized");
  const subscriptionId = parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;
  const stripeProductId = parsedOrg.cloudConfig?.stripe?.activeProductId;
  if (!stripeProductId || !subscriptionId) {
    logger.error("Stripe product ID or subscription ID not found in organization", { orgId, stripeProductId, subscriptionId });
    return false
  }

  // Get subscription from Stripe
  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data.find(
    (i) => i.price.product === stripeProductId
  );
  if (!item) {
    logger.error("No subscription item found for this product", { stripeProductId, subscriptionId });
    return false

  };

  // Increase the quantity (slot count) by 1
  const newQuantity = (item.quantity || 1) + 1;
  await stripeClient.subscriptionItems.update(item.id, {
    quantity: newQuantity,
    // Optionally, you can set proration_behavior if needed
    // proration_behavior: "create_prorations",
  });
  logger.info("Stripe slot increased", { orgId, stripeProductId, newQuantity });

  return true;
}

/**
 * Decrease the slot (quantity) of a Stripe subscription item for an organization by 1.
 * @param orgId - Organization ID
 */
export async function decreaseStripeSlot(orgId: string) {
  // Get organization and parse config
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    logger.error("Organization not found", { orgId });
    return false;
  }
  const parsedOrg = parseDbOrg(org);
  if (!parsedOrg.cloudConfig?.stripe) {
    logger.error("Stripe configuration not found in organization", { orgId });
    return false;
  }
  if (!stripeClient) throw new Error("Stripe client not initialized");
  const subscriptionId = parsedOrg.cloudConfig?.stripe?.activeSubscriptionId;
  const stripeProductId = parsedOrg.cloudConfig?.stripe?.activeProductId;
  if (!stripeProductId || !subscriptionId) {
    logger.error("Stripe product ID or subscription ID not found in organization", { orgId, stripeProductId, subscriptionId });
    return false;
  }

  // Get subscription from Stripe
  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data.find(
    (i) => i.price.product === stripeProductId
  );
  if (!item) {
    logger.error("No subscription item found for this product", { stripeProductId, subscriptionId });
    return false;
  }

  // Decrease the quantity (slot count) by 1, but not less than 1
  const newQuantity = Math.max((item.quantity || 1) - 1, 1);
  await stripeClient.subscriptionItems.update(item.id, {
    quantity: newQuantity,
    // Optionally, you can set proration_behavior if needed
    // proration_behavior: "create_prorations",
  });
  logger.info("Stripe slot decreased", { orgId, stripeProductId, newQuantity });

  return true;
}
