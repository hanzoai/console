import { AgentFieldProvider } from "@/src/features/agents/AgentFieldProvider";
import { PackagesPage } from "@/src/features/agents/pages/PackagesPage";

export default function AgentPackagesRoute() {
  return (
    <AgentFieldProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <PackagesPage />
      </div>
    </AgentFieldProvider>
  );
}
