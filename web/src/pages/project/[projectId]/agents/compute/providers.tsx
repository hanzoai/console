import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { ProvidersPage } from "@/src/features/agents/pages/compute/ProvidersPage";

export default function AgentComputeProvidersRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <ProvidersPage />
      </div>
    </AgentsProvider>
  );
}
