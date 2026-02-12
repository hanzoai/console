import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { ReasonerDetailPage } from "@/src/features/agents/pages/ReasonerDetailPage";

export default function AgentReasonerDetailRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <ReasonerDetailPage />
      </div>
    </AgentsProvider>
  );
}
