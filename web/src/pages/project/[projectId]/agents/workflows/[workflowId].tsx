import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { EnhancedWorkflowDetailPage } from "@/src/features/agents/pages/EnhancedWorkflowDetailPage";

export default function AgentWorkflowDetailRoute() {
  return (
    <AgentsProvider>
      <EnhancedWorkflowDetailPage />
    </AgentsProvider>
  );
}
