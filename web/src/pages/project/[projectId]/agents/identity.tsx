import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { DIDExplorerPage } from "@/src/features/agents/pages/DIDExplorerPage";

export default function AgentIdentityRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <DIDExplorerPage />
      </div>
    </AgentsProvider>
  );
}
