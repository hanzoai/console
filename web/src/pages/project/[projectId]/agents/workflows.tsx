import { AgentFieldProvider } from "@/src/features/agents/AgentFieldProvider";
import { WorkflowsPage } from "@/src/features/agents/pages/WorkflowsPage";

export default function AgentWorkflowsRoute() {
  return (
    <AgentFieldProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <WorkflowsPage />
      </div>
    </AgentFieldProvider>
  );
}
