/**
 * Hanzo Analytics tracking for billing and subscription events
 */

declare global {
  interface Window {
    hanzo?: {
      track: (eventName: string, eventData?: Record<string, any>) => void;
    };
    posthog?: {
      capture: (eventName: string, eventData?: Record<string, any>) => void;
    };
  }
}

export const trackBillingEvent = (
  eventName: string,
  eventData?: Record<string, any>,
) => {
  // Track with Hanzo Analytics
  if (typeof window !== "undefined" && window.hanzo?.track) {
    window.hanzo.track(eventName, eventData);
  }

  // Also track with PostHog for backward compatibility
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.capture(eventName, eventData);
  }
};

// Billing-specific event trackers
export const billingAnalytics = {
  // Subscription events
  subscriptionCreated: (data: {
    planName: string;
    stripeProductId: string;
    amount?: number;
    interval?: string;
  }) => {
    trackBillingEvent("subscription_created", data);
  },

  subscriptionUpdated: (data: {
    oldPlan: string;
    newPlan: string;
    stripeProductId: string;
  }) => {
    trackBillingEvent("subscription_updated", data);
  },

  subscriptionCanceled: (data: { planName: string; reason?: string }) => {
    trackBillingEvent("subscription_canceled", data);
  },

  // Payment events
  paymentSucceeded: (data: {
    amount: number;
    currency: string;
    type: "subscription" | "credit";
  }) => {
    trackBillingEvent("payment_succeeded", data);
  },

  paymentFailed: (data: {
    amount: number;
    currency: string;
    error?: string;
  }) => {
    trackBillingEvent("payment_failed", data);
  },

  // Credit events
  creditsAdded: (data: { amount: number; credits: number }) => {
    trackBillingEvent("credits_added", data);
  },

  creditsUsed: (data: { credits: number; feature: string }) => {
    trackBillingEvent("credits_used", data);
  },

  // Checkout events
  checkoutStarted: (data: { planName: string; stripeProductId: string }) => {
    trackBillingEvent("checkout_started", data);
  },

  checkoutCompleted: (data: {
    planName: string;
    stripeProductId: string;
    sessionId: string;
  }) => {
    trackBillingEvent("checkout_completed", data);
  },

  checkoutAbandoned: (data: { planName: string; stripeProductId: string }) => {
    trackBillingEvent("checkout_abandoned", data);
  },

  // Portal events
  billingPortalAccessed: () => {
    trackBillingEvent("billing_portal_accessed");
  },

  invoiceViewed: (data: { invoiceId: string; amount: number }) => {
    trackBillingEvent("invoice_viewed", data);
  },

  // Trial events
  trialStarted: (data: { trialDays: number }) => {
    trackBillingEvent("trial_started", data);
  },

  trialEnding: (data: { daysRemaining: number }) => {
    trackBillingEvent("trial_ending", data);
  },

  trialExpired: () => {
    trackBillingEvent("trial_expired");
  },

  // Usage events
  usageLimitReached: (data: {
    feature: string;
    limit: number;
    current: number;
  }) => {
    trackBillingEvent("usage_limit_reached", data);
  },

  usageWarning: (data: { feature: string; percentUsed: number }) => {
    trackBillingEvent("usage_warning", data);
  },
};
