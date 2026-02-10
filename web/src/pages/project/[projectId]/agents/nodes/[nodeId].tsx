import { AgentFieldProvider } from "@/src/features/agents/AgentFieldProvider";
import { NodeDetailPage } from "@/src/features/agents/pages/NodeDetailPage";

export default function AgentNodeDetailRoute() {
  return (
    <AgentFieldProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <NodeDetailPage />
      </div>
    </AgentFieldProvider>
  );
}
