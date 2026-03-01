import { type useQueryOrganization } from "@/src/features/organizations/hooks";

export type BillingCancellationInfo = {
  isCancelled: boolean;
  date: Date | null;
  formatted: string | null;
};

export type BillingScheduledSwitchInfo = {
  isScheduled: boolean;
  date: Date | null;
  formatted: string | null;
  newPlanLabel: string | null;
  newPlanId: string | null;
  scheduleId: string | undefined;
  message: string | null | undefined;
};

export type UseBillingInformationResult = {
  isLoading: boolean;
  organization: ReturnType<typeof useQueryOrganization>;
  planLabel: string;
  cancellation: BillingCancellationInfo | null;
  scheduledPlanSwitch: BillingScheduledSwitchInfo | null;
  isLegacySubscription: boolean;
  hasActiveSubscription: boolean;
  hasValidPaymentMethod: boolean;
};

export const useBillingInformation = (): UseBillingInformationResult => ({
  isLoading: false,
  organization: null,
  planLabel: "",
  cancellation: null,
  scheduledPlanSwitch: null,
  isLegacySubscription: false,
  hasActiveSubscription: false,
  hasValidPaymentMethod: false,
});
