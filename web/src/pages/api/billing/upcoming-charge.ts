import { stripeClient } from "@/src/features/billing/utils/stripe";
import { prisma } from "@hanzo/shared/src/db";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }
  const { orgId } = req.query;
  if (!orgId || typeof orgId !== "string") {
    return res.status(400).json({ message: "Missing orgId" });
  }
  // Lấy organization
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    return res.status(404).json({ message: "Organization not found" });
  }
  const cloudConfig = org.cloudConfig as any;
  const subscriptionId = cloudConfig?.stripe?.activeSubscriptionId;
  if (!subscriptionId) {
    return res.status(400).json({ message: "No active Stripe subscription for this organization" });
  }
  if (!stripeClient) {
    return res.status(500).json({ message: "Stripe client not initialized" });
  }
  try {
    const invoice = await stripeClient.invoices.retrieveUpcoming({
      subscription: subscriptionId,
    });
    return res.status(200).json({
      amount_due: invoice.amount_due / 100,
      currency: invoice.currency,
      next_payment_attempt: invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000)
        : null,
      period_end: invoice.period_end
        ? new Date(invoice.period_end * 1000)
        : null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to retrieve upcoming invoice", error: (error as Error).message });
  }
}
