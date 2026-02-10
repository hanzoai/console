import { AgentFieldProvider } from "@/src/features/agents/AgentFieldProvider";
import { DIDExplorerPage } from "@/src/features/agents/pages/DIDExplorerPage";

export default function AgentIdentityRoute() {
  return (
    <AgentFieldProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <DIDExplorerPage />
      </div>
    </AgentFieldProvider>
  );
}
