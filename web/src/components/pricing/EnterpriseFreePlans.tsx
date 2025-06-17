
import { Code, Shield } from "lucide-react";
import PricingPlan from "./PricingPlan";

const EnterpriseFreePlans = () => {
  const enterprisePlan = {
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
  };

  const freePlan = {
    name: "Open Source",
    icon: <Code className="h-6 w-6 text-neutral-400" />,
    price: "Free",
    billingPeriod: "Forever",
    description: "For individuals wanting full control",
    features: [
      "Completely open source (self-host via GitHub)",
      "Full access to platform capabilities",
      "Unlimited deployments on your hardware",
      "Self-hosted AI models and compute",
      "Real-time web search",
      "Custom GPT usage"
    ]
  };

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
      <PricingPlan
        name={enterprisePlan.name}
        icon={enterprisePlan.icon}
        price={enterprisePlan.price}
        description={enterprisePlan.description}
        features={enterprisePlan.features}
      />
      <PricingPlan
        name={freePlan.name}
        icon={freePlan.icon}
        price={freePlan.price}
        billingPeriod={freePlan.billingPeriod}
        description={freePlan.description}
        features={freePlan.features}
        customColor="gray"
      />
    </div>
  );
};

export default EnterpriseFreePlans;
