import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { CreateMachinePage } from "@/src/features/agents/pages/compute/CreateMachinePage";

export default function AgentComputeNewRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <CreateMachinePage />
      </div>
    </AgentsProvider>
  );
}
