import React from "react";
import PricingPlan from "./PricingPlan";
import { Code, Zap, Github } from "lucide-react";
import { stripeProducts } from "@/src/features/billing/utils/stripeProducts";

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
        "Developer tools and CLI",
      ],
      githubLink: true,
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
        "1 AI Credit",
      ],
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
        "Up to 10 AI Credits (Adjustable)",
      ],
    },
  ];

  const plan2 = stripeProducts.map((stripe) => {
    if (stripe.type === "persional") {
      return {
        ...stripe,
        icon: <Code className="h-6 w-6 text-neutral-400" />,
        features: [],
        popular: false,
      };
    }
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
