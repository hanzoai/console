import { AgentFieldProvider } from "@/src/features/agents/AgentFieldProvider";
import { ExecutionsPage } from "@/src/features/agents/pages/ExecutionsPage";

export default function AgentExecutionsRoute() {
  return (
    <AgentFieldProvider>
      <div className="p-4 md:p-6 lg:p-8 min-h-full">
        <ExecutionsPage />
      </div>
    </AgentFieldProvider>
  );
}
