import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { NodesPage } from "@/src/features/agents/pages/NodesPage";

export default function AgentNodesRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <NodesPage />
      </div>
    </AgentsProvider>
  );
}
