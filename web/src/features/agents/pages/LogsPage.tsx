import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "../adapters";
import { PageHeader, TIME_FILTER_OPTIONS } from "../components/PageHeader";
import { getEnhancedExecutions, streamExecutionEvents } from "../services/executionsApi";
import type { EnhancedExecution, ExecutionViewFilters } from "../types/workflows";
import { getNextTimeRange } from "../lib/timeRanges";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import { GuidedEmptyState } from "../components/ui/GuidedEmptyState";

type LogLevel = "all" | "info" | "warn" | "error";

const LOG_LEVEL_OPTIONS = [
  { value: "all", label: "All Levels" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warning" },
  { value: "error", label: "Error" },
];

const PAGE_SIZE = 50;

function statusToLevel(status: string): LogLevel {
  const lower = status.toLowerCase();
  if (lower === "failed" || lower === "error" || lower === "cancelled") return "error";
  if (lower === "running" || lower === "pending" || lower === "queued") return "warn";
  return "info";
}

function LevelBadge({ level }: { level: LogLevel }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-mono uppercase px-1.5 py-0",
        level === "error" && "border-red-500/30 text-red-500 bg-red-500/5",
        level === "warn" && "border-amber-500/30 text-amber-500 bg-amber-500/5",
        level === "info" && "border-blue-500/30 text-blue-500 bg-blue-500/5",
      )}
    >
      {level}
    </Badge>
  );
}

/**
 * Unified log viewer page.
 * Shows execution logs and agent events in a simple list layout.
 * Filters: level, bot name, time range.
 */
export function LogsPage() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("24h");
  const [level, setLevel] = useState<LogLevel>("all");
  const [botFilter, setBotFilter] = useState("");

  const [executions, setExecutions] = useState<EnhancedExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchLogs = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let escalatedTimeRange = false;

    try {
      setLoading(true);
      setError(null);

      const filters: ExecutionViewFilters = {};
      if (timeRange !== "all") {
        filters.timeRange = timeRange;
      }
      const response = await getEnhancedExecutions(filters, "started_at", "desc", 1, PAGE_SIZE, controller.signal);

      const results = response.executions ?? [];

      if (results.length === 0) {
        const broaderRange = getNextTimeRange(timeRange);
        if (broaderRange && broaderRange !== timeRange) {
          escalatedTimeRange = true;
          setTimeRange(broaderRange);
          return;
        }
      }

      setExecutions(results);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      if (!escalatedTimeRange) {
        setLoading(false);
      }
    }
  }, [timeRange]);

  useEffect(() => {
    fetchLogs();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchLogs]);

  // SSE for live updates
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = streamExecutionEvents();
      eventSource.onmessage = (event) => {
        if (!event.data?.trim()?.startsWith("{")) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.execution) {
            fetchLogs();
          }
        } catch {
          // ignore parse errors
        }
      };
      eventSource.onerror = () => {
        // SSE reconnects automatically
      };
    } catch {
      // SSE not available
    }
    return () => {
      eventSource?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter executions by level and bot name
  const filteredLogs = useMemo(() => {
    return executions.filter((exec) => {
      if (level !== "all" && statusToLevel(exec.status) !== level) return false;
      if (botFilter && !exec.agent_name?.toLowerCase().includes(botFilter.toLowerCase())) return false;
      return true;
    });
  }, [executions, level, botFilter]);

  const handleRowClick = (exec: EnhancedExecution) => {
    if (exec.workflow_id) {
      navigate(`/workflows/${exec.workflow_id}`);
    } else {
      navigate(`/executions/${exec.execution_id}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs"
        description="Unified view of execution logs and agent events"
        filters={[
          {
            label: "Time Range",
            value: timeRange,
            options: TIME_FILTER_OPTIONS,
            onChange: (value) => setTimeRange(value),
          },
          {
            label: "Level",
            value: level,
            options: LOG_LEVEL_OPTIONS,
            onChange: (value) => setLevel(value as LogLevel),
          },
        ]}
      />

      {/* Bot name search */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Filter by bot name..."
          value={botFilter}
          onChange={(e) => setBotFilter(e.target.value)}
          className="h-8 w-64 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {botFilter && (
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setBotFilter("")}>
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400 text-sm">{error}</p>
          <button onClick={fetchLogs} className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <GuidedEmptyState
          icon="activity"
          title="No logs yet"
          description="Connect a bot to start streaming logs and execution events"
          primaryAction={{ label: "Connect Bot", href: "/settings" }}
          tip="Run `hanzo bot run` locally to connect"
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {filteredLogs.map((exec) => {
              const logLevel = statusToLevel(exec.status);
              return (
                <button
                  key={exec.execution_id}
                  onClick={() => handleRowClick(exec)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors text-sm"
                >
                  <span className="text-xs text-muted-foreground font-mono w-24 shrink-0">{exec.relative_time}</span>
                  <LevelBadge level={logLevel} />
                  <span className="font-medium truncate min-w-0">
                    {exec.task_name || exec.workflow_name || "Execution"}
                  </span>
                  {exec.agent_name && (
                    <span className="text-xs text-muted-foreground font-mono truncate">{exec.agent_name}</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">{exec.duration_display}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {exec.status}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
