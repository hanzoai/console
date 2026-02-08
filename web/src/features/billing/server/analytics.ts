/**
 * Server-side Hanzo Analytics tracking for billing events
 */

interface AnalyticsEvent {
  name: string;
  data?: Record<string, unknown>;
  websiteId?: string;
  hostname?: string;
  language?: string;
  referrer?: string;
  screen?: string;
  title?: string;
  url?: string;
}

/**
 * Send analytics event to Hanzo Analytics API
 */
export async function trackServerEvent(eventName: string, eventData?: Record<string, unknown>) {
  // Only track if analytics is configured
  const siteId = process.env.NEXT_PUBLIC_HANZO_ANALYTICS_SITE_ID;
  if (!siteId) {
    return;
  }

  const analyticsUrl = process.env.NEXT_PUBLIC_HANZO_ANALYTICS_URL || "https://a.hanzo.ai";
  const collectEndpoint = `${analyticsUrl}/api/send`;

  const payload: AnalyticsEvent = {
    name: eventName,
    data: eventData,
    websiteId: siteId,
    hostname: "cloud.hanzo.ai",
    url: "/api/billing/webhook",
    title: "Billing Webhook",
  };

  try {
    const response = await fetch(collectEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Hanzo-Cloud-Server/1.0",
      },
      body: JSON.stringify({
        type: "event",
        payload,
      }),
    });

    if (!response.ok) {
      console.error(`[Analytics] Failed to track event: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error("[Analytics] Error tracking event:", error);
  }
}

// Server-side billing analytics functions
export const serverBillingAnalytics = {
  subscriptionCreated: async (data: {
    orgId: string;
    planName: string;
    stripeProductId: string;
    amount?: number;
    interval?: string;
    status: string;
  }) => {
    await trackServerEvent("subscription_created", data);
  },

  subscriptionUpdated: async (data: {
    orgId: string;
    oldPlan?: string;
    newPlan: string;
    stripeProductId: string;
    status: string;
  }) => {
    await trackServerEvent("subscription_updated", data);
  },

  subscriptionDeleted: async (data: { orgId: string; planName?: string; stripeProductId?: string }) => {
    await trackServerEvent("subscription_deleted", data);
  },

  paymentSucceeded: async (data: {
    orgId: string;
    amount: number;
    currency: string;
    type: "subscription" | "credit";
  }) => {
    await trackServerEvent("payment_succeeded", data);
  },

  creditsAdded: async (data: { orgId: string; amount: number; credits: number }) => {
    await trackServerEvent("credits_added", data);
  },
};
