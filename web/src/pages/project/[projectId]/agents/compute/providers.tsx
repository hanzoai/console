import { AgentFieldProvider } from "@/src/features/agents/AgentFieldProvider";
import { ProvidersPage } from "@/src/features/agents/pages/compute/ProvidersPage";

export default function AgentComputeProvidersRoute() {
  return (
    <AgentFieldProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <ProvidersPage />
      </div>
    </AgentFieldProvider>
  );
}
