import { useMemo, useState, type ReactNode } from "react";
import { ResponsiveGrid } from "@/src/features/agents/components/layout/ResponsiveGrid";
import { useNavigate } from "../../adapters";
import { RadioTower, CheckCircle2, AlertTriangle, ArrowUpRight } from "@/src/features/agents/components/ui/icon-bridge";
import type { WorkflowSummary, WorkflowTimelineNode } from "../../types/workflows";
import { summarizeWorkflowWebhook, formatWebhookStatusLabel } from "../../utils/webhook";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { retryExecutionWebhook } from "../../services/executionsApi";

interface EnhancedWorkflowWebhooksProps {
  workflow: WorkflowSummary;
  dagData?: { timeline?: WorkflowTimelineNode[] } | null;
  onNodeSelection: (nodeIds: string[], replace?: boolean) => void;
  onRefresh?: () => void;
}

export function EnhancedWorkflowWebhooks({
  dagData,
  onNodeSelection,
  onRefresh,
}: EnhancedWorkflowWebhooksProps) {
  const navigate = useNavigate();
  const timeline = dagData?.timeline ?? [];
  const webhookNodes = useMemo(
    () => timeline.filter((node) => {
      const metaCount = (node.webhook_event_count ?? 0) + (node.webhook_success_count ?? 0) + (node.webhook_failure_count ?? 0);
      return node.webhook_registered || metaCount > 0;
    }),
    [timeline],
  );
  const summary = useMemo(() => summarizeWorkflowWebhook(webhookNodes), [webhookNodes]);
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});
  const [retryErrors, setRetryErrors] = useState<Record<string, string | null>>({});

  const handleRetry = async (executionId: string) => {
    setRetryErrors((prev) => ({ ...prev, [executionId]: null }));
    setRetrying((prev) => ({ ...prev, [executionId]: true }));
    try {
      await retryExecutionWebhook(executionId);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to retry webhook:", err);
      setRetryErrors((prev) => ({
        ...prev,
        [executionId]: err instanceof Error ? err.message : "Retry failed",
      }));
    } finally {
      setRetrying((prev) => {
        const next = { ...prev };
        delete next[executionId];
        return next;
      });
    }
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <ResponsiveGrid columns={{ base: 1, sm: 2, lg: 4 }} gap="sm" align="start" className="p-6 border-b border-border bg-muted/20 text-xs">
        <SummaryCard label="Webhook nodes" value={summary.nodesWithWebhook} icon={<RadioTower className="h-4 w-4" />} />
        <SummaryCard label="Delivered" value={summary.successDeliveries} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <SummaryCard label="Failed" value={summary.failedDeliveries} icon={<AlertTriangle className="h-4 w-4" />} tone={summary.failedDeliveries > 0 ? "danger" : "muted"} />
        <SummaryCard
          label="Pending"
          value={summary.pendingNodes}
          icon={<RadioTower className="h-4 w-4" />}
          hint={summary.lastSentAt ? `Last delivery ${new Date(summary.lastSentAt).toLocaleString()}` : undefined}
        />
      </ResponsiveGrid>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border p-6 space-y-4">
        {webhookNodes.length === 0 ? (
          <div className="text-body-small border border-dashed border-border/60 rounded-lg p-6 text-center">
            This workflow has not registered any webhooks yet.
          </div>
        ) : (
          webhookNodes.map((node) => {
            const successCount = node.webhook_success_count ?? 0;
            const failureCount = node.webhook_failure_count ?? 0;
            const statusLabel = formatWebhookStatusLabel(node.webhook_last_status);
            const hasFailure = failureCount > 0 || statusLabel === "failed";
            const latestTimestamp = node.webhook_last_sent_at
              ? new Date(node.webhook_last_sent_at).toLocaleString()
              : undefined;

            return (
              <div
                key={node.execution_id}
                className="border border-border rounded-xl bg-card/70 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {node.agent_name || node.reasoner_id || 'Unnamed node'}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase tracking-wide",
                          hasFailure
                            ? "border-destructive/40 text-destructive"
                            : successCount > 0
                              ? "border-emerald-500/40 text-emerald-500"
                              : "border-border text-muted-foreground",
                        )}
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                    <p className="text-body-small truncate">
                      {node.execution_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => onNodeSelection([node.execution_id])}
                    >
                      Focus in DAG
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => navigate(`/executions/${node.execution_id}?tab=webhook`)}
                    >
                      View execution <ArrowUpRight className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8"
                      disabled={retrying[node.execution_id]}
                      onClick={() => handleRetry(node.execution_id)}
                    >
                      {retrying[node.execution_id] ? "Retrying…" : "Retry webhook"}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-body-small">
                  <span>{successCount} delivered</span>
                  <span>•</span>
                  <span>{failureCount} failed</span>
                  {latestTimestamp && (
                    <>
                      <span>•</span>
                      <span>{latestTimestamp}</span>
                    </>
                  )}
                  {node.webhook_last_http_status && (
                    <>
                      <span>•</span>
                      <span>HTTP {node.webhook_last_http_status}</span>
                    </>
                  )}
                </div>

                {retryErrors[node.execution_id] && (
                  <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                    {retryErrors[node.execution_id]}
                  </div>
                )}

                {node.webhook_last_error && (
                  <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                    {node.webhook_last_error}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone = "muted",
  hint,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: "muted" | "success" | "danger";
  hint?: string;
}) {
  const toneClasses: Record<typeof tone, string> = {
    muted: "text-foreground",
    success: "text-emerald-500",
    danger: "text-destructive",
  } as const;

  return (
    <div className="flex items-center gap-3 border border-border rounded-lg bg-card/60 px-3 py-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 border border-border">
        {icon}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
          {label}
        </span>
        <span className={cn("text-sm font-semibold", toneClasses[tone])}>{value}</span>
        {hint && <span className="text-body-small text-muted-foreground/70">{hint}</span>}
      </div>
    </div>
  );
}
