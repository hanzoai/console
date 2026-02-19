import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "../adapters";
import { ExecutionsPage } from "./ExecutionsPage";
import { WorkflowsPage } from "./WorkflowsPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/features/agents/components/ui/tabs";

/**
 * Unified executions page with tab toggle between Executions and Workflows.
 * Supports deep-linking: /executions → executions tab, /workflows → workflows tab.
 */
export function UnifiedExecutionsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine initial tab from URL
  const isWorkflowsRoute = location.pathname.endsWith("/workflows") || location.pathname.includes("/workflows/");
  const [activeTab, setActiveTab] = useState(isWorkflowsRoute ? "workflows" : "executions");

  // Sync tab when URL changes externally
  useEffect(() => {
    const isWorkflows = location.pathname.endsWith("/workflows") || location.pathname.includes("/workflows/");
    setActiveTab(isWorkflows ? "workflows" : "executions");
  }, [location.pathname]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Update URL to match tab for deep-linking support
    if (value === "workflows") {
      navigate("/workflows", { replace: true });
    } else {
      navigate("/executions", { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Executions</h1>
        <p className="text-muted-foreground">Monitor agent executions and workflow processes</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList variant="underline">
          <TabsTrigger value="executions" variant="underline">
            Executions
          </TabsTrigger>
          <TabsTrigger value="workflows" variant="underline">
            Workflows
          </TabsTrigger>
        </TabsList>

        <TabsContent value="executions">
          <ExecutionsPage />
        </TabsContent>

        <TabsContent value="workflows">
          <WorkflowsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
