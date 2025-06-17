import React, { useEffect, useState } from "react";
import PricingPlan from "./PricingPlan";
import { Users, Shield, Code } from "lucide-react";
import TeamPlanDetails from "./TeamPlanDetails";

const TeamEnterprisePlans = () => {
  const [fromMaxPlan, setFromMaxPlan] = useState(false);
  const [fromProPlan, setFromProPlan] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const from = urlParams.get('from');
    if (from === 'max') {
      setFromMaxPlan(true);
      setFromProPlan(false);
    } else if (from === 'pro') {
      setFromProPlan(true);
      setFromMaxPlan(false);
    }
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const plans = [
    {
      name: "Team",
      icon: <Users className="h-6 w-6 text-neutral-400" />,
      price: "$30",
      billingPeriod: "/user/month",
      description: "Collaborative teams requiring unified billing",
      popular: true,
      features: [
        "Everything in the Max plan",
        "Higher message limits",
        "Advanced collaborative workspace",
        "Secure workspace with admin console",
        "Unified team billing",
        "Team data excluded from training",
        "Custom GPT creation and sharing",
        "Up to 10 AI Credits per user (Adjustable)"
      ],
      showDetails: true
    },
    {
      name: "Enterprise",
      icon: <Shield className="h-6 w-6 text-neutral-400" />,
      price: "Custom",
      description: "For large businesses requiring enterprise-grade security",
      features: [
        "Everything in the Team plan",
        "Expanded context window",
        "Highest limits on messaging & features",
        "Enhanced security (CSA, SOC 2, GDPR, CCPA)",
        "User management via SCIM and SSO",
        "Domain verification, user analytics",
        "Custom data retention policies",
        "Dedicated support & account management",
        "Customizable AI Credits"
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto mb-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {plans.map((plan) => (
          <PricingPlan
            key={plan.name}
            name={plan.name}
            icon={plan.icon}
            price={plan.price}
            billingPeriod={plan.billingPeriod}
            description={plan.description}
            features={plan.features}
            popular={plan.popular}
            showDetails={plan.showDetails}
            customColor={plan.customColor}
          />
        ))}
      </div>
      
      <TeamPlanDetails fromMaxPlan={fromMaxPlan} fromProPlan={fromProPlan} />
    </div>
  );
};

export default TeamEnterprisePlans;