import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { UnifiedSettingsPage } from "@/src/features/agents/pages/UnifiedSettingsPage";

export default function AgentSettingsRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <UnifiedSettingsPage />
      </div>
    </AgentsProvider>
  );
}
