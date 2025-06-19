import React from "react";
import PricingPlan from "./PricingPlan";
import { Shield, Code } from "lucide-react";

import { stripeProducts } from "@/src/features/billing/utils/stripeProducts";

const TeamEnterprisePlans = ({
  orgId,
  currentSubscription,
}: {
  orgId: string | undefined;
  currentSubscription: any;
}) => {
  const plan2 = [
    ...stripeProducts.map((stripe) => {
      if (stripe.type === "team") {
        return {
          ...stripe,
          icon: <Code className="h-6 w-6 text-neutral-400" />,
          features: [],
          popular: false,
        };
      }
      return null;
    }),
    {
      stripeProductId: "custom",
      name: "Enterprise",
      icon: <Shield className="h-6 w-6 text-neutral-400" />,
      price: "Custom",
      popular: false,
      billingPeriod: "/Custom",
      billingPeriodsObject: {
        "/custom": {
          price: "custom",
          priceId: "custom",
        },
      },
      description:
        "Enterprise plan designed for large organizations that require advanced security, governance, and scalability. Includes everything in the Team plan plus expanded compliance features, customizable data policies, advanced user management, and dedicated enterprise support.",
      features: [
        "Everything in the Team plan",
        "Expanded context window",
        "Highest limits on messaging & features",
        "Enhanced security (CSA, SOC 2, GDPR, CCPA)",
        "User management via SCIM and SSO",
        "Domain verification, user analytics",
        "Custom data retention policies",
        "Dedicated support & account management",
        "Customizable AI Credits",
      ],
    },
  ];

  return (
    <div className="mx-auto mb-16 max-w-7xl">
      <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        {plan2.map((plan) => {
          if (!plan) return;
          return (
            <PricingPlan
              key={plan?.name}
              name={plan?.name!}
              icon={plan?.icon!}
              price={plan?.price!}
              billingPeriod={plan?.billingPeriod}
              billingPeriodsObject={plan?.billingPeriodsObject!}
              description={plan?.description!}
              features={plan?.features ?? []}
              popular={plan?.popular ?? false}
              showDetails={true}
              orgId={orgId}
              currentSubscription={currentSubscription}
              stripeProductId={plan?.stripeProductId}
            />
          );
        })}
      </div>
    </div>
  );
};

export default TeamEnterprisePlans;
