import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { WorkflowsPage } from "@/src/features/agents/pages/WorkflowsPage";

export default function AgentWorkflowsRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <WorkflowsPage />
      </div>
    </AgentsProvider>
  );
}
