import React, { useState } from 'react';
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { api } from "@/src/utils/api";
import { useQueryOrganization } from "@/src/features/organizations/hooks";
import { stripeProducts } from "@/src/ee/features/billing/utils/stripeProducts";
import { useRouter } from "next/router";
import { PlanSelectionModal } from "@/src/ee/features/billing/components/PlanSectionModal";
import { useSession } from "next-auth/react";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";

export const BillingOverview = () => {
  const {data: session} = useSession();
  const router = useRouter();
  const organization = useQueryOrganization();
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  
  const { data: usage } = api.cloudBilling.getUsage.useQuery(
    {
      orgId: organization?.id ?? "",
    },
    {
      enabled: organization !== undefined,
    }
  );
  const { data: subscription } = api.cloudBilling.getSubscription.useQuery(
    {
      orgId: organization?.id ?? "",
    },
    {
      enabled: organization !== undefined,
    }
  );

  // Add debug logging for subscription
  console.log('BillingOverview - Subscription Details:', {
    status: subscription?.status,
    fullSubscription: subscription
  });

  // Fetch organization details to get credits
  const { data: orgDetails } = api.organizations.getDetails.useQuery(
    { orgId: organization?.id ?? "" },
    { enabled: !!organization }
  );

  // Add query for subscription history
  // const { data: subscriptionHistory } = api.cloudBilling.getSubscriptionHistory.useQuery(
  //   {
  //     orgId: organization?.id ?? "",
  //     limit: 5, // Fetch last 5 subscriptions
  //   },
  //   {
  //     enabled: organization !== undefined,
  //   }
  // );

  const createCheckoutSession = api.cloudBilling.createStripeCheckoutSession.useMutation();
  
  const handlePurchaseCredits = async () => {
    const creditsProduct = stripeProducts.find(p => p.id === "credits-plan");
    if (!creditsProduct) {
      console.error("Credits product not found");
      return;
    }
  
    const result = await createCheckoutSession.mutateAsync({
      orgId: organization?.id ?? "",
      stripeProductId: creditsProduct.stripeProductId,
      customerEmail:session?.user?.email ?? ""
    });
    if (result.url) window.location.href = result.url;
  };

  const handleUpgradePlan = () => {
    setIsPlanModalOpen(true);
  };

  const currentPlan = subscription?.plan?.name || "Free Plan";
  const currentUsage = usage?.usageCount || 0;
  const availableCredits = orgDetails?.credits || 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Active Subscription Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              {
                subscription ? "Active Subscription" : "No Subscription"
              }
            </h3>
            <p className="mt-2 text-2xl font-bold">{currentPlan}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {subscription 
                ? (subscription?.current_period_end && (
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      // Check if subscription is scheduled to be canceled
                      if (subscription.cancel_at) {
                        return `Active until: ${new Date(subscription.cancel_at).toLocaleDateString()}`;
                      }

                      switch(subscription.status) {
                        case 'canceled':
                          return `Expires on: ${subscription.current_period_end.toLocaleDateString()}`;
                        case 'past_due':
                          return `Payment overdue since: ${subscription.current_period_end.toLocaleDateString()}`;
                        case 'incomplete':
                          return 'Payment processing';
                        case 'incomplete_expired':
                          return 'Payment failed';
                        case 'trialing':
                          return `Trial ends: ${subscription.current_period_end.toLocaleDateString()}`;
                        case 'unpaid':
                          return 'Payment failed - subscription unpaid';
                        case 'paused':
                          return 'Subscription paused';
                        case 'active':
                        default:
                          return `Next billing date: ${subscription.current_period_end.toLocaleDateString()}`;
                      }
                    })()}
                  </p>
                ))
                : "Free credit grant of $5.00"}
            </p>
          </div>
        </div>
        <Button 
          variant="secondary" 
          className="mt-4 w-full"
          onClick={handleUpgradePlan}
        >
          {subscription ? "Change Plan" : "Upgrade Plan"}
        </Button>
      </Card>

      {/* Payment Summary Card */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-muted-foreground">
          Payment Summary
        </h3>
        <div className="mt-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm">Current Usage</span>
            <span className="font-medium">
              ${currentUsage.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Next Invoice</span>
            <span className="font-medium">
              ${subscription?.price?.amount 
                ? (subscription.price.amount).toFixed(2) 
                : "0.00"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Credits Available</span>
            <span className="font-medium">${availableCredits.toFixed(2)}</span>
          </div>
        </div>
        <Button 
          className="mt-4 w-full"
          onClick={handlePurchaseCredits}
        >
          Purchase Credits
        </Button>
      </Card>

      {/* Upcoming Charges Card */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-muted-foreground">
          Upcoming Charges
        </h3>
        <div className="mt-4 flex items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">
            {subscription
              ? `Next payment of $${((subscription.price?.amount) || 0).toFixed(2)} due ${subscription.current_period_end.toLocaleDateString()}`
              : "No upcoming charges. You're on a free plan."}
          </p>
        </div>
        <Button 
          variant="outline" 
          className="mt-4 w-full"
          onClick={() => router.push("/pricing")}
        >
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

