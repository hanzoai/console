import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { NodeDetailPage } from "@/src/features/agents/pages/NodeDetailPage";

export default function AgentNodeDetailRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <NodeDetailPage />
      </div>
    </AgentsProvider>
  );
}
