import { type planLabels } from "@hanzo/console-core";

export const PlanChangeButton = (_props: {
  orgId: string | undefined;
  currentPlan: keyof typeof planLabels | undefined;
  newPlanTitle: string | undefined;
  isLegacySubscription: boolean;
  isUpgrade: boolean;
  productId: string;
  onProcessing: (id: string | null) => void;
  processing: boolean;
  className?: string;
}) => null;
