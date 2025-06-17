import React from "react";
import PricingPlan from "./PricingPlan";
import { Code, Zap, Github } from "lucide-react";

const PersonalPlans = () => {
  const plans = [
    {
      name: "Dev",
      icon: <Github className="h-6 w-6 text-neutral-400" />,
      price: "Free",
      billingPeriod: " forever",
      description: "Open source tools, run locally and privately",
      features: [
        "Access to Zen and Sho foundational models",
        "Local deployment on your infrastructure", 
        "Full source code access",
        "Community support",
        "Run models privately and securely",
        "No cloud dependencies",
        "All future model updates",
        "Developer tools and CLI"
      ],
      githubLink: true
    },
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
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto mb-16">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
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
            githubLink={plan.githubLink}
          />
        ))}
      </div>
    </div>
  );
};

export default PersonalPlans;