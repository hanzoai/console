import { Button } from "@/src/components/ui/radix-button";
import { api } from "@/src/utils/api";
import { Check } from "lucide-react";
import React, { useState } from "react";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";

interface PricingPlanProps {
  name: string;
  icon: React.ReactNode;
  price: string;
  billingPeriod?: string;
  description: string;
  features: string[];
  popular?: boolean;
  customColor?: string;
  showDetails?: boolean;
  githubLink?: boolean;
  orgId?: string;
  stripeProductId?: string;
  currentSubscription?: any;
  billingPeriodsObject?: any;
}

const PricingPlan = ({
  name,
  icon,
  price,
  billingPeriod,
  description,
  features,
  popular = true,
  customColor,
  showDetails = false,
  githubLink = false,
  currentSubscription,
  orgId,
  stripeProductId,
  billingPeriodsObject,
}: PricingPlanProps) => {
  // Use monochrome design
  const borderColor = popular ? "border-white-700" : "border-white-800";

  const bgColor = popular ? "bg-gray-900/30" : "bg-[var(--black)]/50";

  const { mutate: createCheckoutSession } =
    api.cloudBilling.createStripeCheckoutSession.useMutation({
      onSuccess: (data) => {
        if (data.url) window.location.href = data.url;
      },
      onError: (error) => {
        console.error("Failed to create checkout session", error);
        // TODO: Add error handling toast/notification
      },
    });

  const { mutate: createCheckoutSessionWithPrice } =
    api.cloudBilling.createStripeCheckoutSessionWithPrice.useMutation({
      onSuccess: (data) => {
        if (data.url) window.location.href = data.url;
      },
      onError: (error) => {
        console.error("Failed to create checkout session", error);
        // TODO: Add error handling toast/notification
      },
    });

  const { mutate: cancelSubscription } =
    api.cloudBilling.cancelStripeSubscription.useMutation({
      onSuccess: (data) => {
        // Optionally refresh subscription or show success message
        showSuccessToast({
          title: "Cancel successfull",
          description: data.message ?? "Cancel subscription success",
          duration: 10000,
        });
        // onClose();
      },
      onError: (error: { message: string }) => {
        console.error("Failed to change subscription", error.message);
        // TODO: Add error handling toast/notification
      },
    });

  const isActiveSubscription =
    currentSubscription &&
    !["canceled", "incomplete_expired"].includes(currentSubscription.status);

  const periods = billingPeriodsObject ? Object.keys(billingPeriodsObject) : [];
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0] || undefined);
  const currentPeriodData =
    billingPeriodsObject && selectedPeriod
      ? billingPeriodsObject[selectedPeriod]
      : null;
  const displayPrice = currentPeriodData?.price || price;
  const displayBillingPeriod = selectedPeriod || billingPeriod;
  const displayPriceId = currentPeriodData?.priceId || undefined;

  console.log(displayPrice, displayBillingPeriod, displayPriceId, periods);

  const handlePlanAction = () => {
    const effectiveStripeProductId = stripeProductId;
    const effectivePriceId = displayPriceId;
    console.log(effectiveStripeProductId, effectivePriceId, orgId);
    if (!orgId || !effectiveStripeProductId) return;

    if (periods && periods.length > 0) {
      if (!effectivePriceId) return;
    }
    if (
      isActiveSubscription &&
      currentSubscription.plan.id === effectiveStripeProductId
    ) {
      cancelSubscription({
        orgId,
        stripeProductId: effectiveStripeProductId,
      });
    } else {
      if (periods.length > 0) {
        createCheckoutSessionWithPrice({
          orgId,
          stripeProductId: effectiveStripeProductId,
          priceId: effectivePriceId,
        });
        return;
      }
      createCheckoutSession({
        orgId,
        stripeProductId: effectiveStripeProductId,
      });
    }
  };

  // Button color - prominent option gets white bg, others get outline
  const buttonClass = popular
    ? "bg-[var(--white)] text-black border border-gray-300 hover:bg-transparent hover:text-[var(--white)] hover:border-[var(--white)] transition-all duration-300"
    : "bg-transparent border border-white/20 text-white hover:bg-[var(--white)] hover:text-black transition-all duration-300";

  const renderButton = () => {
    if (githubLink || name === "Dev") {
      return (
        <Button
          className={`mb-8 w-full ${buttonClass}`}
          onClick={() => {
            window.open("https://github.com/hanzoai/", "_blank");
          }}
        >
          Get on GitHub
        </Button>
      );
    } else {
      return (
        <Button
          onClick={() => {
            handlePlanAction();
          }}
          className={`mb-8 w-full ${buttonClass}`}
        >
          {currentSubscription.plan.id === stripeProductId
            ? "Cancel PLan"
            : "Configure Plan"}
        </Button>
      );
    }
  };

  return (
    <div
      className={`relative rounded-2xl border ${borderColor} ${bgColor} p-8 backdrop-blur-sm transition-all duration-300 hover:border-gray-700 hover:bg-gray-900/20`}
    >
      {popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <div className="rounded-full bg-[var(--white)] px-3 py-1 text-sm font-medium text-black">
            Most Popular
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        {icon}
        <h3 className="text-xl font-semibold">{name}</h3>
      </div>

      {periods.length > 1 && (
        <div className="mb-4 flex gap-2">
          {periods.map((period) => (
            <button
              key={period}
              className={`rounded-full border px-3 py-1 ${selectedPeriod === period ? "bg-white text-black" : "border-white/20 bg-transparent text-white"}`}
              onClick={() => setSelectedPeriod(period)}
            >
              {period === "/month"
                ? "Monthly"
                : period === "/year"
                  ? "Yearly"
                  : period}
            </button>
          ))}
        </div>
      )}

      <div className="mb-6">
        <div className="mb-2 flex items-baseline gap-1">
          <span className="text-4xl font-bold">{displayPrice}</span>
          {displayBillingPeriod && (
            <span className="text-neutral-400">{displayBillingPeriod}</span>
          )}
        </div>
        <p className="text-neutral-400">{description}</p>
      </div>

      {renderButton()}

      <ul className="space-y-4">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-neutral-400" />
            <span className="text-neutral-300">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PricingPlan;
