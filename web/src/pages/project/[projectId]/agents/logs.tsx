import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { LogsPage } from "@/src/features/agents/pages/LogsPage";

export default function AgentLogsRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <LogsPage />
      </div>
    </AgentsProvider>
  );
}
