/**
 * Billing Information Hook - EE Stub
 * Billing is handled via Hanzo IAM at hanzo.id
 */

import { type Plan } from "@hanzo/shared";

export interface BillingCancellationInfo {
  isCancelled: boolean;
  date: Date | null;
  formatted: string | null;
}

export interface BillingScheduledSwitchInfo {
  isScheduled: boolean;
  date: Date | null;
  formatted: string | null;
  newPlanLabel: string | null;
  newPlanId: string | null;
  scheduleId: string | undefined;
  message: string | null | undefined;
}

export interface OrganizationStub {
  id: string;
  name: string;
  plan?: Plan;
  cloudConfig?: {
    plan?: Plan;
    monthlyObservationLimit?: number;
    stripe?: {
      customerId?: string;
      activeSubscriptionId?: string;
      activeProductId?: string;
      activeUsageProductId?: string;
      subscriptionStatus?: string;
      isLegacySubscription?: boolean;
    };
  };
}

export interface BillingInformation {
  isLoading: boolean;
  organization: OrganizationStub | null;
  planLabel: string;
  cancellation: BillingCancellationInfo | null;
  scheduledPlanSwitch: BillingScheduledSwitchInfo | null;
  isLegacySubscription: boolean;
  hasActiveSubscription: boolean;
  hasValidPaymentMethod: boolean;
}

export function useBillingInformation(): BillingInformation {
  return {
    isLoading: false,
    organization: null,
    planLabel: "Free",
    cancellation: null,
    scheduledPlanSwitch: null,
    isLegacySubscription: false,
    hasActiveSubscription: false,
    hasValidPaymentMethod: false,
  };
}
