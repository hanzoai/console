import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { billingProducts } from "@/src/features/billing/utils/billingProducts";
import { api } from "@/src/utils/api";
import React from "react";
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
  currentSubscription,
}) => {
  const { mutate: createCheckoutSession } = api.cloudBilling.createCheckoutSession.useMutation({
    onSuccess: (url) => {
      if (url) window.location.href = url;
    },
    onError: (error) => {
      console.error("Failed to create checkout session", error);
      // TODO: Add error handling toast/notification
    },
  });

  const { mutate: cancelSubscription } = api.cloudBilling.cancelSubscription.useMutation({
    onSuccess: () => {
      // Optionally refresh subscription or show success message
      onClose();
    },
    onError: (error: { message: string }) => {
      console.error("Failed to change subscription", error.message);
      // TODO: Add error handling toast/notification
    },
  });

  // Filter out credit-related products
  const availablePlans = billingProducts.filter(
    (product) => product.checkout && product.title !== "Credits" && product.active && product.active === true,
  );

  const isActiveSubscription =
    currentSubscription && !["canceled", "incomplete_expired"].includes(currentSubscription.status);

  // Add debug logging for available plans
  console.log(
    "Available Plans:",
    availablePlans.map((p) => ({
      title: p.title,
      id: p.id,
      productId: p.productId,
    })),
  );

  console.log("Current Subscription Details:", {
    subscription: currentSubscription,
    isActive: isActiveSubscription,
  });

  const handlePlanAction = (productId: string) => {
    console.log("Handle Plan Action:", {
      productId,
      currentPlanId: currentSubscription?.plan?.id,
      isMatch: currentSubscription?.plan?.id === productId,
    });

    // Find the plan details
    const plan = availablePlans.find((p) => p.productId === productId);
    const planName = plan?.title || "Unknown";

    // Check if current subscription exists and is not in a terminal state
    if (isActiveSubscription && currentSubscription.plan.id === productId) {
      console.log("Cancelling subscription for product:", productId);
      // Track cancellation intent
      billingAnalytics.subscriptionCanceled({
        planName,
        reason: "user_initiated",
      });
      // If already subscribed to this plan, cancel the subscription
      cancelSubscription({
        orgId,
      });
    } else {
      console.log("Creating checkout session for product:", productId);
      // Track checkout start
      billingAnalytics.checkoutStarted({
        planName,
        productId,
      });
      // If no current subscription or different plan, create a new checkout session
      createCheckoutSession({
        orgId,
        productId,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{currentSubscription ? "Change Your Plan" : "Choose a Plan"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-3">
          {availablePlans.map((product) => {
            // Calculate button state for each plan
            const isPlanActive = isActiveSubscription && currentSubscription.plan.id === product.productId;

            console.log(`Plan ${product.title} comparison:`, {
              productId: product.productId,
              currentPlanId: currentSubscription?.plan?.id,
              isPlanActive,
              isActiveSubscription,
            });

            return (
              <div key={product.id} className="flex flex-col rounded-lg border p-6">
                <h3 className="mb-4 text-xl font-bold">{product.title}</h3>
                <p className="mb-4 text-muted-foreground">{product.description}</p>

                <div className="mt-auto">
                  <Button
                    variant={isPlanActive ? "destructive" : "default"}
                    className="w-full"
                    onClick={() => handlePlanAction(product.productId)}
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
