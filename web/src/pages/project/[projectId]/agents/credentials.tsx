import { AgentFieldProvider } from "@/src/features/agents/AgentFieldProvider";
import { CredentialsPage } from "@/src/features/agents/pages/CredentialsPage";

export default function AgentCredentialsRoute() {
  return (
    <AgentFieldProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <CredentialsPage />
      </div>
    </AgentFieldProvider>
  );
}
