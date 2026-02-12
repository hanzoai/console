import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { MachineDetailPage } from "@/src/features/agents/pages/compute/MachineDetailPage";

export default function AgentMachineDetailRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <MachineDetailPage />
      </div>
    </AgentsProvider>
  );
}
