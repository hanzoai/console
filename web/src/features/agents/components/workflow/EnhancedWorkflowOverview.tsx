import { useMemo, useCallback, type ReactNode } from "react";
import {
  Activity,
  CheckCircle,
  XCircle,
  Database,
  Clock,
  GaugeCircle,
  Users,
  GitBranch
} from "@/src/features/agents/components/ui/icon-bridge";
import { ResponsiveGrid } from "@/src/features/agents/components/layout/ResponsiveGrid";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import type { WorkflowSummary, WorkflowTimelineNode } from "../../types/workflows";
import type { WorkflowVCChainResponse } from "../../types/did";
import {
  getStatusLabel,
  normalizeExecutionStatus,
} from "../../utils/status";

interface EnhancedWorkflowOverviewProps {
  workflow: WorkflowSummary;
  dagData?: { timeline?: WorkflowTimelineNode[] } | null;
  vcChain?: WorkflowVCChainResponse | null;
  selectedNodeIds: string[];
  onNodeSelection: (nodeIds: string[], replace?: boolean) => void;
}

export function EnhancedWorkflowOverview({
  workflow,
  dagData,
  vcChain,
  onNodeSelection,
}: EnhancedWorkflowOverviewProps) {
  const timeline = useMemo<WorkflowTimelineNode[]>(() => dagData?.timeline ?? [], [dagData?.timeline]);
  const totalNodes = timeline.length || workflow.total_executions || 0;

  const statusCounts = useMemo(() => workflow.status_counts ?? {}, [workflow.status_counts]);

  const successRate = useMemo(() => {
    const terminal =
      (statusCounts.succeeded || 0) +
      (statusCounts.failed || 0) +
      (statusCounts.cancelled || 0) +
      (statusCounts.timeout || 0);
    if (terminal === 0) return 100;
    return Math.round(((statusCounts.succeeded || 0) / terminal) * 100);
  }, [statusCounts]);

  const dataNodes = useMemo(
    () => timeline.filter((node) => node.input_data || node.output_data),
    [timeline]
  );
  const dataCoverage = totalNodes > 0 ? Math.round((dataNodes.length / totalNodes) * 100) : 0;

  const agentBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; duration: number }>();
    timeline.forEach((node) => {
      const key = node.agent_name || node.reasoner_id || 'Unassigned';
      const duration = Number(node.duration_ms) || 0;
      const current = map.get(key) || { count: 0, duration: 0 };
      current.count += 1;
      current.duration += duration;
      map.set(key, current);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        count: value.count,
        totalDuration: value.duration,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [timeline]);

  const recentExecutions = useMemo(() => {
    return [...timeline]
      .sort((a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime())
      .slice(0, 6);
  }, [timeline]);

  const runningExecutions = useMemo(
    () => timeline.filter((node) => normalizeExecutionStatus(node.status) === 'running'),
    [timeline]
  );

  const activeExecutionCount = useMemo(() => {
    if (typeof workflow.active_executions === 'number') {
      return workflow.active_executions;
    }
    return runningExecutions.length + (statusCounts.queued ?? 0) + (statusCounts.pending ?? 0);
  }, [workflow.active_executions, runningExecutions.length, statusCounts]);

  const latestActivity = useMemo(() => {
    if (!timeline.length) {
      return workflow.latest_activity || workflow.started_at;
    }
    const newest = timeline.reduce((latest, node) => {
      const time = new Date(node.completed_at || node.started_at || 0).getTime();
      if (!latest.time || time > latest.time) {
        return { node, time };
      }
      return latest;
    }, { node: timeline[0], time: 0 });
    return newest.node.completed_at || newest.node.started_at || workflow.latest_activity || workflow.started_at;
  }, [timeline, workflow.latest_activity, workflow.started_at]);

  const handleAgentFocus = useCallback(
    (agentName: string) => {
      const matching = timeline
        .filter((node) => (node.agent_name || node.reasoner_id || 'Unassigned') === agentName)
        .map((node) => node.execution_id)
        .slice(0, 25);

      if (matching.length) {
        onNodeSelection(matching, false);
      }
    },
    [timeline, onNodeSelection]
  );

  const formatDuration = (durationMs?: number) => {
    if (!durationMs) return '—';
    if (durationMs < 1000) return `${durationMs} ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)} s`;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const formatTime = (value?: string) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleTimeString();
    } catch {
      return value;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <ResponsiveGrid preset="quarters" gap="md" align="start">
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle>Run status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2 text-body">
            <StatusRow icon={<CheckCircle className="h-3 w-3 text-emerald-500" />} label="Succeeded" value={statusCounts.succeeded || 0} />
            <StatusRow icon={<Activity className="h-3 w-3 text-amber-400" />} label="Running" value={statusCounts.running || 0} />
            <StatusRow icon={<XCircle className="h-3 w-3 text-rose-500" />} label="Failed" value={(statusCounts.failed || 0) + (statusCounts.timeout || 0)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle>Reliability</CardTitle>
            <GaugeCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-heading-1">{successRate}%</span>
              <span className="text-body-small">success rate</span>
            </div>
            <div className="flex items-center justify-between text-body">
              <span>Completed</span>
              <span>{statusCounts.succeeded || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle>Data coverage</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-heading-1">{dataCoverage}%</span>
              <span className="text-body-small">nodes with IO</span>
            </div>
            <div className="flex items-center justify-between text-body">
              <span>Tracked nodes</span>
              <span>{dataNodes.length}/{totalNodes}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle>Timeline</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2 text-body">
            <div className="flex items-center justify-between">
              <span>Duration</span>
              <span className="text-body font-medium text-text-primary">{formatDuration(workflow.duration_ms)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Started</span>
              <span>{formatTime(workflow.started_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Last activity</span>
              <span>{formatTime(latestActivity)}</span>
            </div>
          </CardContent>
        </Card>
      </ResponsiveGrid>

      <ResponsiveGrid columns={{ base: 1, lg: 2 }} gap="md" align="start">
        <Card>
          <CardHeader className="flex items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Active agents
            </CardTitle>
            <span className="text-body-small">{agentBreakdown.length} teams involved</span>
          </CardHeader>
          <CardContent className="space-y-3">
            {agentBreakdown.length === 0 && (
              <p className="text-body-small">Agents will appear here once executions start.</p>
            )}
            {agentBreakdown.map((agent) => {
              const participation = totalNodes > 0 ? Math.max(4, (agent.count / totalNodes) * 100) : 0;
              return (
                <button
                  key={agent.name}
                  onClick={() => handleAgentFocus(agent.name)}
                  className="w-full rounded-lg border border-border/60 bg-muted/10 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  title="Select this agent's recent executions"
                >
                  <div className="flex items-center justify-between text-sm font-medium text-foreground">
                    <span>{agent.name}</span>
                    <span className="text-body-small">{agent.count} steps</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${participation}%` }}
                    />
                  </div>
                  <div className="mt-2 text-body-small text-muted-foreground">Runtime {formatDuration(agent.totalDuration)}</div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              Latest executions
            </CardTitle>
              <span className="text-body-small">{activeExecutionCount} running now</span>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentExecutions.length === 0 && (
              <p className="text-body-small">Execution history will appear once this workflow runs.</p>
            )}
            {recentExecutions.map((node) => {
              const normalized = normalizeExecutionStatus(node.status);
              return (
                <button
                  key={node.execution_id}
                  onClick={() => onNodeSelection([node.execution_id])}
                  className="w-full rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground truncate">
                      {node.agent_name || node.reasoner_id || 'Workflow step'}
                    </span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {getStatusLabel(normalized)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-body-small text-muted-foreground">
                    <span>{formatTime(node.started_at)}</span>
                    <span>{formatDuration(node.duration_ms)}</span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </ResponsiveGrid>

      <Card>
        <CardHeader className="flex flex-col gap-1">
          <CardTitle className="text-sm font-medium">Workflow metadata</CardTitle>
          <span className="text-body-small">Identifiers and trust context</span>
        </CardHeader>
        <CardContent>
          <ResponsiveGrid columns={{ base: 1, md: 2 }} gap="sm" align="start" className="text-body-small">
            <div className="space-y-1">
              <span className="uppercase tracking-wide text-[10px]">Workflow ID</span>
              <code className="block text-xs font-mono bg-muted px-2 py-1 rounded text-foreground">
                {workflow.workflow_id}
              </code>
            </div>
            <div className="space-y-1">
              <span className="uppercase tracking-wide text-[10px]">Agent</span>
              <span className="text-sm font-medium text-foreground">{workflow.agent_name}</span>
            </div>
            {workflow.session_id && (
              <div className="space-y-1">
                <span className="uppercase tracking-wide text-[10px]">Session</span>
                <span className="font-mono text-foreground">{workflow.session_id}</span>
              </div>
            )}
            {vcChain && (
              <div className="space-y-1">
                <span className="uppercase tracking-wide text-[10px]">Verification</span>
                <span className="text-sm text-foreground">VC chain available ({vcChain.component_vcs?.length || 0} credentials)</span>
              </div>
            )}
          </ResponsiveGrid>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusRow({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-body">
      <div className="flex items-center gap-2 text-body text-text-secondary">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-body-small font-mono text-text-primary">{value}</span>
    </div>
  );
}
