
import { Button } from "@/src/components/ui/radix-button";
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
  githubLink = false
}: PricingPlanProps) => {
  // Use monochrome design
  const borderColor = popular
    ? "border-gray-700"
    : "border-gray-800";

  const bgColor = popular
    ? "bg-gray-900/30"
    : "bg-[var(--black)]/50";

  // Button color - prominent option gets white bg, others get outline
  const buttonClass = popular
    ? "bg-[var(--white)] text-black border border-gray-300 hover:bg-transparent hover:text-[var(--white)] hover:border-[var(--white)] transition-all duration-300"
    : "bg-transparent border border-white/20 text-white hover:bg-[var(--white)] hover:text-black transition-all duration-300";

  const renderButton = () => {
    if (githubLink || name === "Dev") {
      return (
        <Button
          className={`w-full mb-8 ${buttonClass}`}
          onClick={() => {
            window.open('https://github.com/hanzoai/', '_blank');
          }}
        >
          Get on GitHub
        </Button>
      );
    } else if (name === "Team" && showDetails) {
      return (
        <Button
          className={`w-full mb-8 ${buttonClass}`}
          onClick={() => {
            const teamConfigSection = document.getElementById('team-config-section');
            if (teamConfigSection) {
              teamConfigSection.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        >
          Configure Plan
        </Button>
      );
    } else if (name === "Pro" && showDetails) {
      return (
        <Button
          className={`w-full mb-8 ${buttonClass}`}
          onClick={() => {
            const teamConfigSection = document.getElementById('team-config-section');
            if (teamConfigSection) {
              window.history.pushState({}, '', window.location.pathname + '?from=pro');
              teamConfigSection.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        >
          Get Started
        </Button>
      );
    } else {
      return (
        <Button className={`w-full mb-8 ${buttonClass}`}>
          Get Started
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
          <div className="bg-[var(--white)] text-black px-3 py-1 rounded-full text-sm font-medium">
            Most Popular
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        {icon}
        <h3 className="text-xl font-semibold">{name}</h3>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1 mb-2">
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
            <Check className="h-5 w-5 text-neutral-400 mt-0.5 flex-shrink-0" />
            <span className="text-neutral-300">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PricingPlan;
