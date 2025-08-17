import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { stripeProducts } from "@/src/features/billing/utils/stripeProducts";
import { api } from "@/src/utils/api";
import React from 'react';
import { billingAnalytics } from "@/src/features/billing/analytics";

interface PlanSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  currentSubscription?: any; // Replace with proper type
}

export const PlanSelectionModal: React.FC<PlanSelectionModalProps> = ({
  isOpen,
  onClose,
  orgId,
  currentSubscription
}) => {
  const { mutate: createCheckoutSession } = api.cloudBilling.createStripeCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error) => {
      console.error("Failed to create checkout session", error);
      // TODO: Add error handling toast/notification
    }
  });

  const { mutate: cancelSubscription } = api.cloudBilling.cancelStripeSubscription.useMutation({
    onSuccess: () => {
      // Optionally refresh subscription or show success message
      onClose();
    },
    onError: (error: { message: string }) => {
      console.error("Failed to change subscription", error.message);
      // TODO: Add error handling toast/notification
    }
  });

  // Filter out credit-related products
  const availablePlans = stripeProducts.filter(
    product => product.checkout && product.title !== "Credits" && product.active && product.active === true
  );

  const isActiveSubscription =
    currentSubscription &&
    !['canceled', 'incomplete_expired'].includes(currentSubscription.status);

  // Add debug logging for available plans
  console.log('Available Plans:', availablePlans.map(p => ({
    title: p.title,
    id: p.id,
    stripeProductId: p.stripeProductId
  })));

  console.log('Current Subscription Details:', {
    subscription: currentSubscription,
    isActive: isActiveSubscription
  });

  const handlePlanAction = (stripeProductId: string) => {
    console.log('Handle Plan Action:', {
      stripeProductId,
      currentPlanId: currentSubscription?.plan?.id,
      isMatch: currentSubscription?.plan?.id === stripeProductId
    });

    // Find the plan details
    const plan = availablePlans.find(p => p.stripeProductId === stripeProductId);
    const planName = plan?.title || 'Unknown';

    // Check if current subscription exists and is not in a terminal state
    if (isActiveSubscription && currentSubscription.plan.id === stripeProductId) {
      console.log('Cancelling subscription for product:', stripeProductId);
      // Track cancellation intent
      billingAnalytics.subscriptionCanceled({
        planName,
        reason: 'user_initiated'
      });
      // If already subscribed to this plan, cancel the subscription
      cancelSubscription({
        orgId,
        stripeProductId
      });
    } else {
      console.log('Creating checkout session for product:', stripeProductId);
      // Track checkout start
      billingAnalytics.checkoutStarted({
        planName,
        stripeProductId
      });
      // If no current subscription or different plan, create a new checkout session
      createCheckoutSession({
        orgId,
        stripeProductId
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {currentSubscription ? "Change Your Plan" : "Choose a Plan"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-6">
          {availablePlans.map((product) => {
            // Calculate button state for each plan
            const isPlanActive = isActiveSubscription &&
              currentSubscription.plan.id === product.stripeProductId;

            console.log(`Plan ${product.title} comparison:`, {
              productId: product.stripeProductId,
              currentPlanId: currentSubscription?.plan?.id,
              isPlanActive,
              isActiveSubscription
            });

            return (
              <div
                key={product.id}
                className="border rounded-lg p-6 flex flex-col"
              >
                <h3 className="text-xl font-bold mb-4">{product.title}</h3>
                <p className="text-muted-foreground mb-4">{product.description}</p>

                <div className="mt-auto">
                  <Button
                    variant={isPlanActive ? "destructive" : "default"}
                    className="w-full"
                    onClick={() => handlePlanAction(product.stripeProductId)}
                  >
                    {isPlanActive
                      ? "Cancel Plan"
                      : (isActiveSubscription ? "Change to " : "Upgrade to ") + product.title}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
