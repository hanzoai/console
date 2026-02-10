import { AgentFieldProvider } from "@/src/features/agents/AgentFieldProvider";
import { ReasonerDetailPage } from "@/src/features/agents/pages/ReasonerDetailPage";

export default function AgentReasonerDetailRoute() {
  return (
    <AgentFieldProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <ReasonerDetailPage />
      </div>
    </AgentFieldProvider>
  );
}
