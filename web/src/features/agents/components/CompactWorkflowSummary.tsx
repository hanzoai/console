import {
  CheckCircle,
  SpinnerGap,
  WarningOctagon,
  PauseCircle,
  CopySimple,
  Pulse,
  X,
  Clock
} from "@/src/features/agents/components/ui/icon-bridge";
import { useState } from "react";
import { cn } from "@/src/features/agents/lib/utils";
import { Button } from "./ui/button";
import { normalizeExecutionStatus } from "../utils/status";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "./ui/hover-card";
import type { WorkflowSummary } from "../types/workflows";
import { statusTone, type StatusTone } from "@/src/features/agents/lib/theme";

interface CompactWorkflowSummaryProps {
  workflow: WorkflowSummary;
  onClose?: () => void;
  className?: string;
  // Live update props
  isLiveUpdating?: boolean;
  hasRunningWorkflows?: boolean;
  pollingInterval?: number;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export function CompactWorkflowSummary({
  workflow,
  onClose,
  className,
  isLiveUpdating,
  hasRunningWorkflows,
  pollingInterval,
  isRefreshing,
  onRefresh
}: CompactWorkflowSummaryProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(workflow.workflow_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy workflow ID:', err);
    }
  };

  const formatDuration = (durationMs?: number) => {
    if (!durationMs) return "N/A";
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();

    if (diffMs < 60000) return "now";
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h`;
    return `${Math.floor(diffMs / 86400000)}d`;
  };

  const formatStartedTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const status = normalizeExecutionStatus(workflow.status);
  const statusCounts = workflow.status_counts ?? {};
  const activeExecutions = workflow.active_executions ?? 0;
  const failedExecutions = (statusCounts.failed ?? 0) + (statusCounts.timeout ?? 0);

  const getStatusIcon = () => {
    const baseClasses = "h-4 w-4 flex-shrink-0";
    const toneByStatus: Record<string, StatusTone> = {
      succeeded: "success",
      running: "info",
      failed: "error",
      cancelled: "neutral",
      timeout: "warning",
      queued: "warning",
      pending: "warning",
    };
    const tone = toneByStatus[status] ?? "neutral";

    switch (status) {
      case "succeeded":
        return <CheckCircle className={cn(baseClasses, statusTone[tone].accent)} />;
      case "running":
        return <SpinnerGap className={cn(baseClasses, statusTone[tone].accent, "animate-pulse")} />;
      case "failed":
        return <WarningOctagon className={cn(baseClasses, statusTone[tone].accent)} />;
      case "cancelled":
        return <PauseCircle className={cn(baseClasses, statusTone[tone].accent)} />;
      case "timeout":
        return <Clock className={cn(baseClasses, statusTone[tone].accent)} />;
      case "queued":
      case "pending":
        return <SpinnerGap className={cn(baseClasses, statusTone[tone].accent)} />;
      default:
        return <Pulse className={cn(baseClasses, statusTone.neutral.accent)} />;
    }
  };

  return (
    <div className={cn(
      "bg-card border border-border rounded-lg px-4 py-3 foundation-transition",
      "hover:bg-card/80 hover:border-border/80",
      className
    )}>
      {/* Ultra-Compact Single Bar */}
      <div className="flex items-center justify-between gap-4 text-sm">
        {/* Left: Status + Name + ID */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Status Icon */}
          {getStatusIcon()}

          {/* Workflow Name */}
          <span className="font-medium text-foreground truncate">
            {workflow.display_name || "Unnamed Workflow"}
          </span>

          <span className="text-muted-foreground/60">•</span>

          {/* Full Workflow ID */}
          <div className="flex items-center gap-2">
            <span className="text-body-small">ID:</span>
            <HoverCard>
              <HoverCardTrigger asChild>
                <code
                  className="font-mono text-xs bg-muted/50 px-2 py-1 rounded cursor-pointer hover:bg-muted/70 transition-colors"
                  onDoubleClick={(event) => {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(event.target as Node);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                  }}
                >
                  {workflow.workflow_id}
                </code>
              </HoverCardTrigger>
              <HoverCardContent className="w-auto p-2">
                <p className="text-xs">Double-click to select • Click copy to clipboard</p>
              </HoverCardContent>
            </HoverCard>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyId}
              className="h-5 w-5 p-0 hover:bg-muted/80"
            >
              <CopySimple className="h-3 w-3" />
            </Button>

            {copied && (
              <span className={cn("text-xs font-medium animate-in fade-in duration-200", statusTone.success.accent)}>
                ✓
              </span>
            )}
          </div>
        </div>

        {/* Center: Metrics */}
        <div className="hidden md:flex items-center gap-3 text-body-small">
          <span>Exec: <span className="font-medium text-foreground">{workflow.total_executions}</span></span>
          <span>•</span>
          <span>Depth: <span className="font-medium text-foreground">{workflow.max_depth}</span></span>
          <span>•</span>
          <span className="font-mono">{formatDuration(workflow.duration_ms)}</span>
          {(activeExecutions > 0 || failedExecutions > 0) && (
            <>
              <span>•</span>
              <span className="flex items-center gap-2">
                {activeExecutions > 0 && (
                  <span className="text-foreground">{activeExecutions} active</span>
                )}
                {failedExecutions > 0 && (
                  <span className={statusTone.error.accent}>{failedExecutions} issues</span>
                )}
              </span>
            </>
          )}

          {/* Live Update Status */}
          {isLiveUpdating && (
            <>
              <span>•</span>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      hasRunningWorkflows
                        ? cn(statusTone.success.solidBg, "animate-pulse")
                        : statusTone.neutral.solidBg
                    )} />
                    <span className="font-medium">
                      {hasRunningWorkflows ? "Live" : "Monitor"}
                    </span>
                    {isRefreshing && (
                      <SpinnerGap className={cn("h-3 w-3 animate-spin", statusTone.info.accent)} />
                    )}
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-auto p-3">
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-4">
                      <span>Status:</span>
                      <span className="font-medium">
                        {hasRunningWorkflows ? "Live updates active" : "Monitoring for changes"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Polling:</span>
                      <span className="font-medium">
                        Every {pollingInterval ? Math.round(pollingInterval / 1000) : 3}s
                        {hasRunningWorkflows && " (fast mode)"}
                      </span>
                    </div>
                    {onRefresh && (
                      <div className="pt-2 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onRefresh}
                          disabled={isRefreshing}
                          className="h-6 text-xs w-full"
                        >
                          {isRefreshing ? "Refreshing..." : "Refresh now"}
                        </Button>
                      </div>
                    )}
                  </div>
                </HoverCardContent>
              </HoverCard>
            </>
          )}
        </div>

        {/* Right: Timestamps + Close */}
        <div className="flex items-center gap-3 text-body-small flex-shrink-0">
          <HoverCard>
            <HoverCardTrigger asChild>
              <span className="cursor-pointer hover:text-foreground transition-colors">
                Started: <span className="font-medium">{formatStartedTime(workflow.started_at)}</span>
              </span>
            </HoverCardTrigger>
            <HoverCardContent className="w-auto p-2">
              <p className="text-xs">{new Date(workflow.started_at).toLocaleString()}</p>
            </HoverCardContent>
          </HoverCard>

          {workflow.latest_activity && (
            <>
              <span>•</span>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <span className="cursor-pointer hover:text-foreground transition-colors">
                    Latest: <span className="font-medium">{formatRelativeTime(workflow.latest_activity)} ago</span>
                  </span>
                </HoverCardTrigger>
                <HoverCardContent className="w-auto p-2">
                  <p className="text-xs">{new Date(workflow.latest_activity).toLocaleString()}</p>
                </HoverCardContent>
              </HoverCard>
            </>
          )}

          {onClose && (
            <>
              <span>•</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-5 w-5 p-0 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile: Metrics Row */}
      <div className="md:hidden flex items-center gap-3 text-body-small mt-2 pt-2 border-t border-border/50">
        <span>Exec: <span className="font-medium text-foreground">{workflow.total_executions}</span></span>
        <span>•</span>
        <span>Depth: <span className="font-medium text-foreground">{workflow.max_depth}</span></span>
        <span>•</span>
        <span className="font-mono">{formatDuration(workflow.duration_ms)}</span>
        <span>•</span>
        <span>Agent: <span className="font-medium text-foreground">{workflow.agent_name}</span></span>

        {/* Mobile Live Update Status */}
        {isLiveUpdating && (
          <>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                hasRunningWorkflows
                  ? cn(statusTone.success.solidBg, "animate-pulse")
                  : statusTone.neutral.solidBg
              )} />
              <span className="font-medium">
                {hasRunningWorkflows ? "Live" : "Monitor"}
              </span>
              {isRefreshing && (
                <SpinnerGap className={cn("h-3 w-3 animate-spin", statusTone.info.accent)} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
