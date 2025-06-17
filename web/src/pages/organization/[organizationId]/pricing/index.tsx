import PageHeader from "@/src/components/layouts/page-header";
import APIPricing from "@/src/components/pricing/APIPricing";
import BillingManagement from "@/src/components/pricing/BillingManagement";
import FeatureComparison from "@/src/components/pricing/FeatureComparison";
import PersonalPlans from "@/src/components/pricing/PersonalPlans";
import PricingFAQ from "@/src/components/pricing/PricingFAQ";
import PricingHeader from "@/src/components/pricing/PricingHeader";
import TeamEnterprisePlans from "@/src/components/pricing/TeamEnterprisePlans";
import { useState } from "react";

const PricingPlans = () => {
  const [activeTab, setActiveTab] = useState("personal");

  const tabs = [
    { id: "personal", label: "Personal" },
    { id: "team", label: "Team & Enterprise" },
    { id: "api", label: "API" },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "personal":
        return (
          <>
            <PersonalPlans />
            {/* <FeatureComparison /> */}
            <PricingFAQ />
            <BillingManagement />
          </>
        );
      case "team":
        return (
          <>
            <TeamEnterprisePlans />
            {/* <FeatureComparison /> */}
            <PricingFAQ />
            <BillingManagement />
          </>
        );
      // case "api":
      //   return <APIPricing />;
      default:
        return <PersonalPlans />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--black)] text-[var(--white)]">
      <PageHeader
        title="Pricing"
        breadcrumb={[{ name: "pricing", href: "/pricing" }]}
        container={true}
      />
      <main className="px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        {/* <PricingHeader /> */}

        {/* Tab Navigation */}
        <div className="mx-auto mb-12 max-w-3xl">
          <div className="flex justify-center">
            <div className="rounded-full border border-gray-800 bg-gray-900/50 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-6 py-3 text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-white text-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </main>
    </div>
  );
};

export default PricingPlans;
