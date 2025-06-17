import { Button } from "@/src/components/ui/radix-button";
import { api } from "@/src/utils/api";
import { Check } from "lucide-react";
import React from "react";

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
}

const PricingPlan = ({
  name,
  icon,
  price,
  billingPeriod,
  description,
  features,
  popular = false,
  customColor,
  showDetails = false,
  githubLink = false,
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

  const { mutate: cancelSubscription } =
    api.cloudBilling.cancelStripeSubscription.useMutation({
      onSuccess: () => {
        // Optionally refresh subscription or show success message
        // onClose();
      },
      onError: (error: { message: string }) => {
        console.error("Failed to change subscription", error.message);
        // TODO: Add error handling toast/notification
      },
    });

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
    } else if (name.toLowerCase() === "Team" && showDetails) {
      return (
        <Button
          className={`mb-8 w-full ${buttonClass}`}
          onClick={() => {
            const teamConfigSection = document.getElementById(
              "team-config-section",
            );
            if (teamConfigSection) {
              teamConfigSection.scrollIntoView({ behavior: "smooth" });
            }
          }}
        >
          Configure Plan
        </Button>
      );
    } else if (name.toLowerCase() === "Pro" && showDetails) {
      return (
        <Button
          className={`mb-8 w-full ${buttonClass}`}
          onClick={() => {
            const teamConfigSection = document.getElementById(
              "team-config-section",
            );
            if (teamConfigSection) {
              window.history.pushState(
                {},
                "",
                window.location.pathname + "?from=pro",
              );
              teamConfigSection.scrollIntoView({ behavior: "smooth" });
            }
          }}
        >
          Configure Plan
        </Button>
      );
    } else {
      return (
        <Button className={`mb-8 w-full ${buttonClass}`}>Configure Plan</Button>
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

      <div className="mb-6">
        <div className="mb-2 flex items-baseline gap-1">
          <span className="text-4xl font-bold">{price}</span>
          {billingPeriod && (
            <span className="text-neutral-400">{billingPeriod}</span>
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
