import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { EnhancedDashboardPage } from "@/src/features/agents/pages/EnhancedDashboardPage";

export default function AgentDashboardRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <EnhancedDashboardPage />
      </div>
    </AgentsProvider>
  );
}
