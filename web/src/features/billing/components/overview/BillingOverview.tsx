import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PlanSelectionModal } from "@/src/features/billing/components/PlanSectionModal";
import { billingProducts } from "@/src/features/billing/utils/billingProducts";
import { useQueryOrganization } from "@/src/features/organizations/hooks";
import { api } from "@/src/utils/api";
import { useRouter } from "next/router";
import { useState } from "react";
import { planLabels, type Plan } from "@hanzo/shared";

export const BillingOverview = () => {
  const router = useRouter();
  const organization = useQueryOrganization();
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  const { data: usage } = api.cloudBilling.getUsage.useQuery(
    {
      orgId: organization?.id ?? "",
    },
    {
      enabled: organization !== undefined,
    },
  );
  const { data: subscription } = api.cloudBilling.getSubscriptionInfo.useQuery(
    {
      orgId: organization?.id ?? "",
    },
    {
      enabled: organization !== undefined,
    },
  );

  // Fetch organization details to get credits
  const { data: orgDetails } = api.organizations.getDetails.useQuery(
    { orgId: organization?.id ?? "" },
    { enabled: !!organization },
  );

  const createCheckoutSession = api.cloudBilling.createCheckoutSession.useMutation();

  const handlePurchaseCredits = async () => {
    const creditsProduct = billingProducts.find((p) => p.id === "credits-plan");
    if (!creditsProduct) {
      console.error("Credits product not found");
      return;
    }

    const url = await createCheckoutSession.mutateAsync({
      orgId: organization?.id ?? "",
      productId: creditsProduct.productId,
    });
    if (url) window.location.href = url;
  };

  const handleUpgradePlan = () => {
    setIsPlanModalOpen(true);
  };

  // Get plan from organization
  const currentPlanKey = organization?.plan as Plan | undefined;
  const currentPlan = currentPlanKey ? planLabels[currentPlanKey] : "Free Plan";
  const currentUsage = usage?.usageCount || 0;
  const availableCredits = orgDetails?.credits || 0;

  const hasActiveSubscription = Boolean(organization?.cloudConfig?.stripe?.activeSubscriptionId);

  // Format billing period end date
  const billingPeriodEnd = subscription?.billingPeriod?.end;
  const nextBillingDate = billingPeriodEnd ? new Date(billingPeriodEnd).toLocaleDateString() : null;

  // Check for cancellation
  const isCanceled = Boolean(subscription?.cancellation);
  const cancelAt = subscription?.cancellation?.cancelAt ? new Date(subscription.cancellation.cancelAt * 1000) : null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Active Subscription Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              {hasActiveSubscription ? "Active Subscription" : "No Subscription"}
            </h3>
            <p className="mt-2 text-2xl font-bold">{currentPlan}</p>
            <div className="mt-1 text-sm text-muted-foreground">
              {hasActiveSubscription ? (
                <>
                  {isCanceled && cancelAt ? (
                    <p>Active until: {cancelAt.toLocaleDateString()}</p>
                  ) : nextBillingDate ? (
                    <p>Next billing date: {nextBillingDate}</p>
                  ) : null}
                </>
              ) : (
                <div>Free credit grant of $5.00</div>
              )}
            </div>
          </div>
        </div>

        <Button variant="secondary" className="mt-4 w-full" onClick={handleUpgradePlan}>
          {hasActiveSubscription ? "Change Plan" : "Upgrade Plan"}
        </Button>
      </Card>

      {/* Payment Summary Card */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-muted-foreground">Payment Summary</h3>
        <div className="mt-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm">Current Usage</span>
            <span className="font-medium">${currentUsage.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Credits Available</span>
            <span className="font-medium">${availableCredits.toFixed(2)}</span>
          </div>
        </div>
        <Button className="mt-4 w-full" onClick={handlePurchaseCredits}>
          Purchase Credits
        </Button>
      </Card>

      {/* Upcoming Charges Card */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-muted-foreground">Upcoming Charges</h3>
        <div className="mt-4 flex items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">
            {hasActiveSubscription && nextBillingDate
              ? `Next billing date: ${nextBillingDate}`
              : "No upcoming charges. You're on a free plan."}
          </p>
        </div>
        <Button variant="outline" className="mt-4 w-full" onClick={() => router.push("/pricing")}>
          View Pricing
        </Button>
      </Card>

      <PlanSelectionModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        orgId={organization?.id ?? ""}
        currentSubscription={subscription}
      />
    </div>
  );
};
