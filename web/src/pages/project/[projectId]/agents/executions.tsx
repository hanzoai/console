import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { ExecutionsPage } from "@/src/features/agents/pages/ExecutionsPage";

export default function AgentExecutionsRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <ExecutionsPage />
      </div>
    </AgentsProvider>
  );
}
