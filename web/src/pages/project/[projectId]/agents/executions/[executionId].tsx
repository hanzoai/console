import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { EnhancedExecutionDetailPage } from "@/src/features/agents/pages/EnhancedExecutionDetailPage";

export default function AgentExecutionDetailRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <EnhancedExecutionDetailPage />
      </div>
    </AgentsProvider>
  );
}
