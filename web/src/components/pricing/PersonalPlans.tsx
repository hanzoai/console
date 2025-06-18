import React from "react";
import PricingPlan from "./PricingPlan";
import { Code } from "lucide-react";
import { stripeProducts } from "@/src/features/billing/utils/stripeProducts";

const PersonalPlans = ({
  orgId,
  currentSubscription,
}: {
  orgId: string | undefined;
  currentSubscription: any;
}) => {
  const plan2 = stripeProducts.map((stripe) => {
    if (stripe.type === "persional") {
      return {
        ...stripe,
        icon: <Code className="h-6 w-6 text-neutral-400" />,
        features: [],
        popular: false,
      };
    }
    return null;
  });

  return (
    <div className="mx-auto mb-16 max-w-7xl">
      <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-3">
        {plan2.map((plan) => {
          if (plan) {
            return (
              <PricingPlan
                key={plan.name}
                name={plan.name ?? ""}
                icon={plan.icon}
                price={plan.price ?? ""}
                billingPeriod={plan.billingPeriod}
                description={plan.description ?? ""}
                features={plan.features ?? []}
                popular={plan.popular ?? false}
                orgId={orgId}
                stripeProductId={plan.stripeProductId}
                currentSubscription={currentSubscription}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default PersonalPlans;
