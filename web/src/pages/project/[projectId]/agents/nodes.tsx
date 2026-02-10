import { AgentFieldProvider } from "@/src/features/agents/AgentFieldProvider";
import { NodesPage } from "@/src/features/agents/pages/NodesPage";

export default function AgentNodesRoute() {
  return (
    <AgentFieldProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <NodesPage />
      </div>
    </AgentFieldProvider>
  );
}
