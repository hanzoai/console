import { Route, BrowserRouter as Router, Routes } from "./adapters";
import { SidebarNew } from "./components/Navigation/SidebarNew";
import { TopNavigation } from "./components/Navigation/TopNavigation";
import { RootRedirect } from "./components/RootRedirect";
import { primarySections, moreSections } from "./config/navigation";
import { ModeProvider } from "./contexts/ModeContext";
import { ThemeProvider } from "./components/theme-provider";
import { useFocusManagement } from "./hooks/useFocusManagement";
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar";
import { AllReasonersPage } from "./pages/AllReasonersPage.tsx";
import { EnhancedDashboardPage } from "./pages/EnhancedDashboardPage";
import { UnifiedExecutionsPage } from "./pages/UnifiedExecutionsPage";
import { ExecutionsPage } from "./pages/ExecutionsPage";
import { EnhancedExecutionDetailPage } from "./pages/EnhancedExecutionDetailPage";
import { EnhancedWorkflowDetailPage } from "./pages/EnhancedWorkflowDetailPage";
import { NodeDetailPage } from "./pages/NodeDetailPage";
import { NodesPage } from "./pages/NodesPage";
import { PackagesPage } from "./pages/PackagesPage";
import { ReasonerDetailPage } from "./pages/ReasonerDetailPage.tsx";
import { WorkflowDeckGLTestPage } from "./pages/WorkflowDeckGLTestPage";
import { DIDExplorerPage } from "./pages/DIDExplorerPage";
import { CredentialsPage } from "./pages/CredentialsPage";
import { UnifiedSettingsPage } from "./pages/UnifiedSettingsPage";
import { WelcomePage } from "./pages/WelcomePage";
import { LogsPage } from "./pages/LogsPage";
import { AuthProvider } from "./contexts/AuthContext";
import { AuthGuard } from "./components/AuthGuard";

// Placeholder pages for routes not yet implemented

function PlaygroundPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-heading-1 mb-2">Playground</h2>
        <p className="text-body">Canvas for visual bot orchestration</p>
      </div>
    </div>
  );
}

function BotsPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-heading-1 mb-2">Bots</h2>
        <p className="text-body">All bots in this space</p>
      </div>
    </div>
  );
}

function SpacesPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-heading-1 mb-2">Spaces</h2>
        <p className="text-body">List and manage all spaces</p>
      </div>
    </div>
  );
}

function TeamsPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-heading-1 mb-2">Teams</h2>
        <p className="text-body">Team provisioning and management</p>
      </div>
    </div>
  );
}

const pad = "p-4 md:p-6 lg:p-8 min-h-full";

function AppContent() {
  useFocusManagement();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-background text-foreground transition-colors">
        {/* Sidebar — 6 primary items + collapsible More */}
        <SidebarNew primarySections={primarySections} moreSections={moreSections} />

        {/* Main Content */}
        <SidebarInset>
          {/* Top Navigation */}
          <TopNavigation />

          {/* Main Content Area */}
          <main className="flex flex-1 min-w-0 flex-col overflow-y-auto overflow-x-hidden">
            <Routes>
              {/* Root redirect — smart routing */}
              <Route
                path="/"
                element={
                  <div className={pad}>
                    <RootRedirect />
                  </div>
                }
              />

              {/* PRIMARY routes */}
              <Route
                path="/dashboard"
                element={
                  <div className={pad}>
                    <EnhancedDashboardPage />
                  </div>
                }
              />
              <Route
                path="/bots/all"
                element={
                  <div className={pad}>
                    <BotsPage />
                  </div>
                }
              />
              <Route
                path="/playground"
                element={
                  <div className={pad}>
                    <PlaygroundPage />
                  </div>
                }
              />
              <Route
                path="/executions"
                element={
                  <div className={pad}>
                    <UnifiedExecutionsPage />
                  </div>
                }
              />
              <Route
                path="/workflows"
                element={
                  <div className={pad}>
                    <UnifiedExecutionsPage />
                  </div>
                }
              />
              <Route
                path="/logs"
                element={
                  <div className={pad}>
                    <LogsPage />
                  </div>
                }
              />

              {/* Settings — tabbed (Gateway / Space / Webhooks) */}
              <Route
                path="/settings"
                element={
                  <div className={pad}>
                    <UnifiedSettingsPage />
                  </div>
                }
              />
              <Route
                path="/settings/space"
                element={
                  <div className={pad}>
                    <UnifiedSettingsPage />
                  </div>
                }
              />
              <Route
                path="/settings/webhooks"
                element={
                  <div className={pad}>
                    <UnifiedSettingsPage />
                  </div>
                }
              />
              {/* Legacy redirect */}
              <Route
                path="/settings/observability-webhook"
                element={
                  <div className={pad}>
                    <UnifiedSettingsPage />
                  </div>
                }
              />

              {/* MORE routes */}
              <Route
                path="/spaces"
                element={
                  <div className={pad}>
                    <SpacesPage />
                  </div>
                }
              />
              <Route
                path="/teams"
                element={
                  <div className={pad}>
                    <TeamsPage />
                  </div>
                }
              />
              <Route
                path="/identity/dids"
                element={
                  <div className={pad}>
                    <DIDExplorerPage />
                  </div>
                }
              />
              <Route
                path="/identity/credentials"
                element={
                  <div className={pad}>
                    <CredentialsPage />
                  </div>
                }
              />
              <Route
                path="/packages"
                element={
                  <div className={pad}>
                    <PackagesPage />
                  </div>
                }
              />

              {/* Detail routes */}
              <Route
                path="/nodes"
                element={
                  <div className={pad}>
                    <NodesPage />
                  </div>
                }
              />
              <Route
                path="/nodes/:nodeId"
                element={
                  <div className={pad}>
                    <NodeDetailPage />
                  </div>
                }
              />
              <Route
                path="/reasoners/all"
                element={
                  <div className={pad}>
                    <AllReasonersPage />
                  </div>
                }
              />
              <Route
                path="/reasoners/:fullReasonerId"
                element={
                  <div className={pad}>
                    <ReasonerDetailPage />
                  </div>
                }
              />
              <Route
                path="/executions/:executionId"
                element={
                  <div className={pad}>
                    <EnhancedExecutionDetailPage />
                  </div>
                }
              />
              <Route path="/workflows/:workflowId" element={<EnhancedWorkflowDetailPage />} />

              {/* Dev/test */}
              <Route
                path="/test/deckgl"
                element={
                  <div className={pad}>
                    <WorkflowDeckGLTestPage />
                  </div>
                }
              />
            </Routes>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

/**
 * Welcome page renders full-screen (outside sidebar layout).
 */
function WelcomeRoute() {
  return <WelcomePage />;
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ModeProvider>
        <AuthProvider>
          <AuthGuard>
            <Router basename={"/ui"}>
              <Routes>
                <Route path="/welcome" element={<WelcomeRoute />} />
                <Route path="/*" element={<AppContent />} />
              </Routes>
            </Router>
          </AuthGuard>
        </AuthProvider>
      </ModeProvider>
    </ThemeProvider>
  );
}

export default App;
