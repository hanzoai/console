import { AgentFieldProvider } from "@/src/features/agents/AgentFieldProvider";
import { EnhancedDashboardPage } from "@/src/features/agents/pages/EnhancedDashboardPage";

export default function AgentDashboardRoute() {
  return (
    <AgentFieldProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <EnhancedDashboardPage />
      </div>
    </AgentFieldProvider>
  );
}
