import { AgentFieldProvider } from "@/src/features/agents/AgentFieldProvider";
import { AllReasonersPage } from "@/src/features/agents/pages/AllReasonersPage";

export default function AgentReasonersRoute() {
  return (
    <AgentFieldProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <AllReasonersPage />
      </div>
    </AgentFieldProvider>
  );
}
