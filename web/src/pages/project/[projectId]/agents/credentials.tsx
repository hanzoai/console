import { AgentsProvider } from "@/src/features/agents/AgentsProvider";
import { CredentialsPage } from "@/src/features/agents/pages/CredentialsPage";

export default function AgentCredentialsRoute() {
  return (
    <AgentsProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <CredentialsPage />
      </div>
    </AgentsProvider>
  );
}
