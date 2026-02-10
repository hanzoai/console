import { AgentFieldProvider } from "@/src/features/agents/AgentFieldProvider";
import { EnhancedWorkflowDetailPage } from "@/src/features/agents/pages/EnhancedWorkflowDetailPage";

export default function AgentWorkflowDetailRoute() {
  return (
    <AgentFieldProvider>
      <EnhancedWorkflowDetailPage />
    </AgentFieldProvider>
  );
}
