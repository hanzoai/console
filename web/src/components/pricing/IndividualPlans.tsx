
import React, { useEffect, useState } from "react";
import PricingPlan from "./PricingPlan";
import { Code, Users, Zap } from "lucide-react";
import TeamPlanDetails from "./TeamPlanDetails";

const IndividualPlans = () => {
  const [fromProPlan, setFromProPlan] = useState(false);
  const [fromDevPlan, setFromDevPlan] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const from = urlParams.get('from');
    if (from === 'pro') {
      setFromProPlan(true);
      setFromDevPlan(false);
    } else if (from === 'dev') {
      setFromDevPlan(true);
      setFromProPlan(false);
    }
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const plans = [
    {
      name: "Pro",
      icon: <Code className="h-6 w-6 text-neutral-400" />,
      price: "$20",
      billingPeriod: "/month",
      description: "Ideal for hobbyists and occasional use",
      features: [
        "All core Hanzo platform features",
        "Unlimited private projects",
        "Unlimited deployments",
        "Self-hosted on your infrastructure",
        "Full deployment functionality",
        "Hanzo integration",
        "Automated backups",
        "All upcoming feature updates",
        "1 AI Credit"
      ]
    },
    {
      name: "Max",
      icon: <Zap className="h-6 w-6 text-neutral-400" />,
      price: "$200",
      billingPeriod: "/month",
      description: "For professionals and small businesses",
      popular: true,
      features: [
        "Everything in the Pro plan",
        "Extended messaging and data analysis",
        "Full access to Hanzo App, Chat, Dev",
        "Integration with Hanzo Models",
        "Image generation",
        "Real-time web search",
        "Access to deep research models",
        "Up to 10 AI Credits (Adjustable)"
      ],
      showDetails: true
    },
    {
      name: "Team",
      icon: <Users className="h-6 w-6 text-neutral-400" />,
      price: "$30",
      billingPeriod: "/user/month",
      description: "Collaborative teams requiring unified billing",
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
    }
  ];

  return (
    <div className="max-w-7xl mx-auto mb-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
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
          />
        ))}
      </div>
      
      <TeamPlanDetails fromProPlan={fromProPlan} fromDevPlan={fromDevPlan} />
    </div>
  );
};

export default IndividualPlans;
