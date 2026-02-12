import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { AllReasonersPage } from "@/src/features/agents/pages/AllReasonersPage";

export default function AgentReasonersRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <AllReasonersPage />
      </div>
    </AgentsProvider>
  );
}
