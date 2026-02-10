import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "../../adapters";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { UnifiedDataPanel } from "../ui/UnifiedDataPanel";
import { UnifiedJsonViewer } from "../ui/UnifiedJsonViewer";
import {
  ResizableSplitPane,
  useResponsiveSplitPane,
} from "../ui/ResizableSplitPane";
import {
  Download,
  Database,
  InProgress,
  RadioTower,
} from "@/src/features/agents/components/ui/icon-bridge";
import { DataModal } from "../execution/EnhancedModal";
import { DownloadSimple, UploadSimple } from "@/src/features/agents/components/ui/icon-bridge";
import { cn } from "../../lib/utils";
import { getStatusLabel, normalizeExecutionStatus } from "../../utils/status";
import type {
  WorkflowSummary,
  WorkflowTimelineNode,
} from "../../types/workflows";
import type {
  WorkflowExecution,
  ExecutionWebhookEvent,
} from "../../types/executions";
import { getExecutionDetails } from "../../services/executionsApi";
import { formatWebhookStatusLabel } from "../../utils/webhook";

interface EnhancedWorkflowDataProps {
  workflow: WorkflowSummary;
  dagData?: { timeline?: WorkflowTimelineNode[] } | null;
  selectedNodeIds: string[];
  onNodeSelection: (nodeIds: string[], replace?: boolean) => void;
}

const formatDuration = (durationMs?: number) => {
  if (!durationMs) return "—";
  if (durationMs < 1000) return `${durationMs} ms`;
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)} s`;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return "—";
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
};

export function EnhancedWorkflowData({
  dagData,
  selectedNodeIds,
  onNodeSelection,
}: EnhancedWorkflowDataProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<
    Record<string, WorkflowExecution | null>
  >({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>(
    {}
  );
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [leftPanelSize, setLeftPanelSize] = useState(30);
  const [inputModalOpen, setInputModalOpen] = useState(false);
  const [outputModalOpen, setOutputModalOpen] = useState(false);

  // Responsive behavior
  const { isSmallScreen } = useResponsiveSplitPane(1024);

  const timeline = useMemo<WorkflowTimelineNode[]>(
    () => dagData?.timeline ?? [],
    [dagData?.timeline]
  );

  const searchableQuery = searchQuery.trim().toLowerCase();

  const getDetailsFor = useCallback(
    (executionId: string) => detailsCache[executionId] ?? undefined,
    [detailsCache]
  );

  const ensureDetails = useCallback(
    async (executionId: string) => {
      if (
        detailsCache[executionId] !== undefined ||
        loadingDetails[executionId]
      ) {
        return;
      }

      setLoadingDetails((prev) => ({ ...prev, [executionId]: true }));
      setDetailErrors((prev) => {
        if (!prev[executionId]) return prev;
        const next = { ...prev };
        delete next[executionId];
        return next;
      });

      try {
        const details = await getExecutionDetails(executionId);
        setDetailsCache((prev) => ({ ...prev, [executionId]: details }));
      } catch (error) {
        setDetailsCache((prev) => ({ ...prev, [executionId]: null }));
        setDetailErrors((prev) => ({
          ...prev,
          [executionId]:
            error instanceof Error
              ? error.message
              : "Failed to load execution details",
        }));
      } finally {
        setLoadingDetails((prev) => {
          const next = { ...prev };
          delete next[executionId];
          return next;
        });
      }
    },
    [detailsCache, loadingDetails]
  );

  const hasData = useCallback((value: unknown): boolean => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return true;
  }, []);

  const getNodeInput = useCallback(
    (node: WorkflowTimelineNode) => {
      const details = getDetailsFor(node.execution_id);
      if (details) return details.input_data;
      if (details === null) return null;
      return node.input_data ?? null;
    },
    [getDetailsFor]
  );

  const getNodeOutput = useCallback(
    (node: WorkflowTimelineNode) => {
      const details = getDetailsFor(node.execution_id);
      if (details) return details.output_data;
      if (details === null) return null;
      return node.output_data ?? null;
    },
    [getDetailsFor]
  );

  const filteredNodes = useMemo(() => {
    return timeline.filter((node) => {
      if (searchableQuery) {
        const inputData = getNodeInput(node);
        const outputData = getNodeOutput(node);
        const basis = [
          node.agent_name,
          node.reasoner_id,
          node.execution_id,
          node.status,
          JSON.stringify(inputData ?? {}),
          JSON.stringify(outputData ?? {}),
        ]
          .join(" ")
          .toLowerCase();
        if (!basis.includes(searchableQuery)) {
          return false;
        }
      }

      return true;
    });
  }, [timeline, getNodeInput, getNodeOutput, searchableQuery]);

  const visibleNodes = filteredNodes;

  const nodesWithData = useMemo(() => {
    return timeline.filter((node) => {
      const details = detailsCache[node.execution_id];
      const input =
        details && details !== null
          ? details.input_data
          : (node.input_data ?? null);
      const output =
        details && details !== null
          ? details.output_data
          : (node.output_data ?? null);
      return hasData(input) || hasData(output);
    });
  }, [timeline, detailsCache, hasData]);

  useEffect(() => {
    if (visibleNodes.length === 0) {
      setActiveNodeId(null);
      return;
    }

    setActiveNodeId((current) => {
      if (
        current &&
        visibleNodes.some((node) => node.execution_id === current)
      ) {
        return current;
      }
      return visibleNodes[0]?.execution_id ?? null;
    });
  }, [visibleNodes]);

  const activeNode = useMemo(() => {
    if (!activeNodeId) return null;
    return timeline.find((node) => node.execution_id === activeNodeId) || null;
  }, [timeline, activeNodeId]);

  const activeDetails = useMemo(() => {
    if (!activeNodeId) return undefined;
    return detailsCache[activeNodeId];
  }, [detailsCache, activeNodeId]);

  const activeWebhookEvents: ExecutionWebhookEvent[] = useMemo(() => {
    if (
      !activeDetails ||
      activeDetails === null ||
      !activeDetails.webhook_events
    ) {
      return [];
    }
    return activeDetails.webhook_events;
  }, [activeDetails]);

  const webhookRegistered = !!(
    activeDetails &&
    activeDetails !== null &&
    activeDetails.webhook_registered
  );

  const activeInput =
    activeDetails && activeDetails !== null
      ? activeDetails.input_data
      : (activeNode?.input_data ?? null);

  const activeOutput =
    activeDetails && activeDetails !== null
      ? activeDetails.output_data
      : (activeNode?.output_data ?? null);

  const activeIsLoading = activeNodeId ? !!loadingDetails[activeNodeId] : false;
  const activeError = activeNodeId ? detailErrors[activeNodeId] : undefined;

  const parseEventPayload = useCallback((raw: unknown) => {
    if (raw === null || raw === undefined) {
      return null;
    }
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    return raw;
  }, []);

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setActiveNodeId(nodeId);
      onNodeSelection([nodeId], true);
    },
    [onNodeSelection]
  );

  const handleOpenExecutionPage = useCallback(() => {
    if (!activeNode) return;
    navigate(`/executions/${encodeURIComponent(activeNode.execution_id)}`);
  }, [navigate, activeNode]);

  const handleOpenReasonerPage = useCallback(() => {
    const agentNodeId =
      activeNode?.agent_node_id || activeDetails?.agent_node_id;
    const reasonerId = activeNode?.reasoner_id || activeDetails?.reasoner_id;

    if (!agentNodeId || !reasonerId) return;

    const fullReasonerId = `${agentNodeId}.${reasonerId}`;
    navigate(`/reasoners/${encodeURIComponent(fullReasonerId)}`);
  }, [navigate, activeNode, activeDetails]);

  const handleDownloadNode = useCallback(() => {
    if (!activeNode) return;
    const payload = {
      execution_id: activeNode.execution_id,
      agent_name: activeNode.agent_name,
      reasoner_id: activeNode.reasoner_id,
      status: activeNode.status,
      duration_ms: activeNode.duration_ms,
      started_at: activeNode.started_at,
      completed_at: activeNode.completed_at,
      input_data: activeInput ?? null,
      output_data: activeOutput ?? null,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeNode.execution_id}-io.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [activeNode, activeInput, activeOutput]);

  const statusBadge = (status?: string) => {
    if (!status) return null;
    const normalized = normalizeExecutionStatus(status);
    const label = getStatusLabel(normalized);
    const palette: Record<string, string> = {
      succeeded:
        "bg-emerald-500/10 text-emerald-500 border border-emerald-500/40",
      running: "bg-sky-500/10 text-sky-500 border border-sky-500/40",
      failed: "bg-rose-500/10 text-rose-500 border border-rose-500/40",
      cancelled: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
      timeout: "bg-amber-500/10 text-amber-500 border border-amber-500/40",
      queued: "bg-violet-500/10 text-violet-400 border border-violet-500/40",
      pending: "bg-violet-500/10 text-violet-400 border border-violet-500/40",
    };
    const classes =
      palette[normalized] ?? "bg-muted text-foreground border border-border/50";
    return (
      <span
        className={cn(
          "text-body-small px-2 py-0.5 rounded-full uppercase tracking-wide",
          classes
        )}
      >
        {label}
      </span>
    );
  };

  const renderListItem = (node: WorkflowTimelineNode) => {
    const isActive = node.execution_id === activeNodeId;
    const isSelectedInGraph = selectedNodeIds.includes(node.execution_id);
    const details = getDetailsFor(node.execution_id);
    const isLoading = !!loadingDetails[node.execution_id];
    const nodeError = detailErrors[node.execution_id];
    const inputData =
      details && details !== null
        ? details.input_data
        : (node.input_data ?? null);
    const outputData =
      details && details !== null
        ? details.output_data
        : (node.output_data ?? null);
    const detailWebhookEvents = Array.isArray(details?.webhook_events)
      ? [...details!.webhook_events].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      : [];
    const detailWebhookFailure = detailWebhookEvents.some((event) => {
      const status = event.status?.toLowerCase();
      return status === "failed" || Boolean(event.error_message);
    });
    const detailWebhookSuccess = detailWebhookEvents.some((event) => {
      const status = event.status?.toLowerCase();
      return (
        status === "succeeded" || status === "success" || status === "delivered"
      );
    });
    const detailLatestWebhookStatus = detailWebhookEvents[0]?.status;
    const nodeHasWebhookMetadata = Boolean(
      node.webhook_registered ||
        (node.webhook_event_count ?? 0) > 0 ||
        (node.webhook_success_count ?? 0) > 0 ||
        (node.webhook_failure_count ?? 0) > 0
    );
    const hasWebhook = Boolean(
      nodeHasWebhookMetadata ||
        (details &&
          details !== null &&
          (details.webhook_registered ||
            (Array.isArray(details.webhook_events) &&
              details.webhook_events.length > 0)))
    );
    const webhookHasFailure =
      detailWebhookFailure || (node.webhook_failure_count ?? 0) > 0;
    const webhookHasSuccess =
      detailWebhookSuccess || (node.webhook_success_count ?? 0) > 0;
    const webhookStatusLabel = formatWebhookStatusLabel(
      detailLatestWebhookStatus ?? node.webhook_last_status
    );
    const hasInput = hasData(inputData);
    const hasOutput = hasData(outputData);
    const inputPreview = hasInput ? summarisePreview(inputData) : null;
    const outputPreview = hasOutput ? summarisePreview(outputData) : null;

    return (
      <button
        key={node.execution_id}
        onClick={() => handleSelectNode(node.execution_id)}
        className={cn(
          "w-full text-left rounded-lg border border-transparent px-3 py-3 transition-colors duration-150",
          "hover:border-border hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          isActive && "border-primary/40 bg-primary/5"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground truncate">
              {node.agent_name || node.reasoner_id || "Unnamed node"}
            </span>
            <span className="text-body-small truncate">
              {node.reasoner_id || node.execution_id}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isSelectedInGraph && (
              <Badge variant="outline" className="text-[10px]">
                Graph
              </Badge>
            )}
            {statusBadge(node.status)}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3 text-body-small">
          <span>{formatTimestamp(node.started_at)}</span>
          <span>•</span>
          <span>{formatDuration(node.duration_ms)}</span>
        </div>
        <div className="mt-2 flex items-center gap-1">
          {isLoading && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <InProgress className="h-3 w-3 animate-spin" /> Loading
            </span>
          )}
          {!isLoading && nodeError && (
            <span className="text-[10px] uppercase tracking-wide text-destructive">
              {nodeError}
            </span>
          )}
          {!isLoading &&
            !nodeError &&
            (hasWebhook || nodeHasWebhookMetadata) && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase tracking-wide flex items-center gap-1",
                  webhookHasFailure
                    ? "border-destructive/40 text-destructive"
                    : webhookHasSuccess
                      ? "border-emerald-500/40 text-emerald-500"
                      : "border-border text-muted-foreground"
                )}
              >
                <RadioTower className="h-3 w-3" />
                {webhookStatusLabel || "Webhook"}
              </Badge>
            )}
        </div>
        {(inputPreview || outputPreview) && (
          <div className="mt-2 space-y-1 text-body-small font-mono text-muted-foreground/80">
            {inputPreview && (
              <div className="line-clamp-2">in: {inputPreview}</div>
            )}
            {outputPreview && (
              <div className="line-clamp-2">out: {outputPreview}</div>
            )}
          </div>
        )}
      </button>
    );
  };

  useEffect(() => {
    const candidates = visibleNodes
      .slice(0, 25)
      .map((node) => node.execution_id);
    candidates.forEach((executionId) => {
      void ensureDetails(executionId);
    });
  }, [visibleNodes, ensureDetails]);

  useEffect(() => {
    if (activeNodeId) {
      void ensureDetails(activeNodeId);
    }
  }, [activeNodeId, ensureDetails]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard events when not typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (visibleNodes.length === 0) return;

      const currentIndex = activeNodeId
        ? visibleNodes.findIndex((node) => node.execution_id === activeNodeId)
        : -1;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (currentIndex < visibleNodes.length - 1) {
            const nextNode = visibleNodes[currentIndex + 1];
            handleSelectNode(nextNode.execution_id);
          }
          break;
        case "ArrowUp":
          event.preventDefault();
          if (currentIndex > 0) {
            const prevNode = visibleNodes[currentIndex - 1];
            handleSelectNode(prevNode.execution_id);
          }
          break;
        case "Home":
          event.preventDefault();
          if (visibleNodes.length > 0) {
            handleSelectNode(visibleNodes[0].execution_id);
          }
          break;
        case "End":
          event.preventDefault();
          if (visibleNodes.length > 0) {
            handleSelectNode(
              visibleNodes[visibleNodes.length - 1].execution_id
            );
          }
          break;
        case "Enter":
        case " ":
          if (activeNodeId) {
            event.preventDefault();
            onNodeSelection([activeNodeId], true);
          }
          break;
        case "Escape":
          event.preventDefault();
          setActiveNodeId(null);
          break;
        case "/":
          event.preventDefault();
          // Focus search input
          const searchInput = document.querySelector(
            'input[placeholder*="Search"]'
          ) as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visibleNodes, activeNodeId, handleSelectNode, onNodeSelection]);

  return (
    <div className="h-full flex flex-col">
      {/* Responsive Split Pane Layout */}
      <ResizableSplitPane
        defaultSizePercent={isSmallScreen ? 100 : leftPanelSize}
        minSizePercent={20}
        maxSizePercent={60}
        collapsible={true}
        onSizeChange={setLeftPanelSize}
        orientation={isSmallScreen ? "vertical" : "horizontal"}
        className="flex-1"
        leftPanelClassName="bg-muted/10"
        rightPanelClassName=""
      >
        {[
          // Left Panel - Search + Node List
          <div key="node-list" className="h-full flex flex-col space-y-4 p-4">
            <Input
              placeholder="Search by agent, reasoner, execution, or JSON content"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
            <div className="flex-1 overflow-y-auto space-y-2">
              {visibleNodes.length > 0 ? (
                <>{visibleNodes.map(renderListItem)}</>
              ) : (
                <div className="px-2 py-16 text-center text-body-small">
                  {nodesWithData.length === 0 && (
                    <div className="flex flex-col items-center gap-3">
                      <Database className="h-10 w-10 text-muted-foreground" />
                      <span>No workflow steps emitted input/output yet.</span>
                    </div>
                  )}
                  {nodesWithData.length > 0 && (
                    <>
                      <p>No matches with the current filters.</p>
                      <p className="mt-1 text-xs">
                        Try clearing search or switching the view.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>,

          // Right Panel - Metadata + Controls + Data
          <div
            key="node-details"
            className="h-full flex flex-col space-y-6 p-6"
          >
            {activeNode ? (
              <>
                {/* Metadata Header */}
                <div className="space-y-2">
                  <h3 className="text-heading-3">
                    {activeNode.agent_name ||
                      activeNode.reasoner_id ||
                      "Selected node"}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-body-small">
                    <span className="font-mono">{activeNode.execution_id}</span>
                    <span>•</span>
                    {statusBadge(activeNode.status)}
                    <span>•</span>
                    <span>{formatDuration(activeNode.duration_ms)}</span>
                    <span>•</span>
                    <span>Depth {activeNode.workflow_depth ?? "—"}</span>
                  </div>
                  <div className="text-body-small text-muted-foreground">
                    Started: {formatTimestamp(activeNode.started_at)}
                    {activeNode.completed_at && (
                      <>
                        {" "}
                        • Completed: {formatTimestamp(activeNode.completed_at)}
                      </>
                    )}
                  </div>
                </div>

                {/* Controls Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenExecutionPage}
                  >
                    Go to Execution
                  </Button>
                  {(activeNode?.reasoner_id || activeDetails?.reasoner_id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenReasonerPage}
                    >
                      Go to Reasoner
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadNode}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download JSON
                  </Button>
                </div>

                {/* Loading and Error States */}
                {activeIsLoading && (
                  <div className="flex items-center gap-2 text-body-small">
                    <InProgress className="h-4 w-4 animate-spin" /> Loading
                    execution details…
                  </div>
                )}

                {activeError && (
                  <div className="text-xs text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    {activeError}
                  </div>
                )}

                {/* Data Panels with Responsive Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="h-[420px] border border-border rounded-lg overflow-hidden">
                    <UnifiedDataPanel
                      data={activeInput}
                      title="Input Data"
                      type="input"
                      size={activeDetails?.input_size}
                      isLoading={activeIsLoading}
                      onModalOpen={() => setInputModalOpen(true)}
                      maxHeight="none"
                      className="h-full"
                    />
                  </div>
                  <div className="h-[420px] border border-border rounded-lg overflow-hidden">
                    <UnifiedDataPanel
                      data={activeOutput}
                      title="Output Data"
                      type="output"
                      size={activeDetails?.output_size}
                      isLoading={activeIsLoading}
                      onModalOpen={() => setOutputModalOpen(true)}
                      maxHeight="none"
                      className="h-full"
                    />
                  </div>
                </div>

                {/* Input Modal */}
                <DataModal
                  isOpen={inputModalOpen}
                  onClose={() => setInputModalOpen(false)}
                  title="Input Data"
                  icon={DownloadSimple}
                  data={activeInput}
                />

                {/* Output Modal */}
                <DataModal
                  isOpen={outputModalOpen}
                  onClose={() => setOutputModalOpen(false)}
                  title="Output Data"
                  icon={UploadSimple}
                  data={activeOutput}
                />

                {(webhookRegistered || activeWebhookEvents.length > 0) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <RadioTower className="w-4 h-4" />
                        Webhook Activity
                      </div>
                      {webhookRegistered &&
                        activeWebhookEvents.length === 0 && (
                          <Badge variant="outline" className="text-xs">
                            Registered
                          </Badge>
                        )}
                    </div>

                    {activeWebhookEvents.length > 0 ? (
                      <div className="space-y-4">
                        {activeWebhookEvents.map((event) => {
                          const payloadData = parseEventPayload(event.payload);
                          const payloadIsRenderable =
                            payloadData !== null && payloadData !== undefined;
                          return (
                            <div
                              key={event.id}
                              className="border border-border rounded-lg bg-muted/10 p-4 space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      event.status === "failed"
                                        ? "destructive"
                                        : "secondary"
                                    }
                                    className="text-xs capitalize"
                                  >
                                    {event.status}
                                  </Badge>
                                  {event.http_status !== undefined && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      HTTP {event.http_status}
                                    </Badge>
                                  )}
                                  {event.event_type && (
                                    <span className="text-body-small uppercase tracking-wide">
                                      {event.event_type}
                                    </span>
                                  )}
                                </div>
                                <span className="text-body-small">
                                  {formatTimestamp(event.created_at)}
                                </span>
                              </div>

                              {event.error_message && (
                                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                                  {event.error_message}
                                </div>
                              )}

                              {payloadIsRenderable && (
                                <div className="space-y-2">
                                  <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                                    Payload
                                  </span>
                                  {typeof payloadData === "string" ? (
                                    <pre className="text-xs whitespace-pre-wrap bg-background border border-border/50 rounded px-3 py-2">
                                      {payloadData}
                                    </pre>
                                  ) : (
                                    <UnifiedJsonViewer
                                      data={payloadData}
                                      maxHeight="220px"
                                      showHeader={false}
                                      collapsible={false}
                                      className="border border-border/40 bg-background"
                                    />
                                  )}
                                </div>
                              )}

                              {event.response_body && (
                                <div className="space-y-1 text-xs">
                                  <span className="font-semibold text-foreground uppercase tracking-wide">
                                    Response
                                  </span>
                                  <pre className="whitespace-pre-wrap break-words bg-background border border-border/50 rounded px-3 py-2 text-muted-foreground">
                                    {event.response_body}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-body-small">
                        Webhook registered for this execution. No deliveries
                        have been recorded yet.
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <Database className="h-12 w-12 mb-4" />
                <p className="text-sm">
                  Select a workflow step from the list to inspect its inputs and
                  outputs.
                </p>
                {visibleNodes.length > 0 && (
                  <p className="text-xs mt-2 opacity-70">
                    {visibleNodes.length} node
                    {visibleNodes.length === 1 ? "" : "s"} available
                  </p>
                )}
              </div>
            )}
          </div>,
        ]}
      </ResizableSplitPane>
    </div>
  );
}

function summarisePreview(data: unknown): string {
  if (!data || typeof data !== "object") {
    return String(data ?? "∅");
  }

  const entries = Object.entries(data as Record<string, unknown>).slice(0, 3);
  return entries
    .map(([key, value]) => `${key}: ${previewValue(value)}`)
    .join(", ");
}

function previewValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") {
    return value.length > 24 ? `${value.slice(0, 21)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value || {});
    return `{${keys.slice(0, 2).join(", ")}}`;
  }
  return String(value);
}
