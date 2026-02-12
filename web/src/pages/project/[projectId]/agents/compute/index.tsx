import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { ComputePage } from "@/src/features/agents/pages/compute/ComputePage";

export default function AgentComputeRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <ComputePage />
      </div>
    </AgentsProvider>
  );
}
