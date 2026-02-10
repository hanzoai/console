import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "../adapters";
import {
  PageHeader,
  STATUS_FILTER_OPTIONS,
  TIME_FILTER_OPTIONS,
} from "../components/PageHeader";
import { CompactWorkflowsTable } from "../components/CompactWorkflowsTable";
import type { WorkflowSummary, ExecutionViewFilters } from "../types/workflows";
import { getWorkflowsSummary } from "../services/workflowsApi";
import { getNextTimeRange } from "../lib/timeRanges";
import "../styles/workflow-table.css";

const PAGE_SIZE = 100;

export function WorkflowsPage() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("24h");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("latest_activity");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const filters = useMemo(() => {
    const params: ExecutionViewFilters = {};
    if (status !== "all") {
      params.status = status;
    }
    if (timeRange !== "all") {
      params.timeRange = timeRange;
    }
    return params;
  }, [status, timeRange]);

  const fetchWorkflows = useCallback(
    async (targetPage: number, reset: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let escalatedTimeRange = false;

      try {
        if (reset) {
          setLoading(true);
          setError(null);
        } else {
          setFetchingMore(true);
        }

        const response = await getWorkflowsSummary(
          filters,
          targetPage,
          PAGE_SIZE,
          sortBy,
          sortOrder,
          controller.signal
        );

        const nextWorkflows = response.workflows ?? [];

        if (reset && targetPage === 1 && nextWorkflows.length === 0) {
          const broaderRange = getNextTimeRange(timeRange);
          if (broaderRange && broaderRange !== timeRange) {
            escalatedTimeRange = true;
            setTimeRange(broaderRange);
            return;
          }
        }

        setWorkflows((prev) =>
          reset ? nextWorkflows : [...prev, ...nextWorkflows]
        );
        setHasMore(response.has_more ?? nextWorkflows.length === PAGE_SIZE);
        setPage(targetPage);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch workflows:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load workflows"
        );
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        if (reset) {
          if (!escalatedTimeRange) {
            setLoading(false);
          }
        } else {
          setFetchingMore(false);
        }
      }
    },
    [filters, sortBy, sortOrder, timeRange]
  );

  // Initial and reactive fetch
  useEffect(() => {
    setWorkflows([]);
    setPage(1);
    setHasMore(true);
    fetchWorkflows(1, true);

    return () => {
      abortRef.current?.abort();
    };
  }, [filters, sortBy, sortOrder, timeRange]); // Use actual dependencies instead of fetchWorkflows

  const handleWorkflowClick = (workflow: WorkflowSummary) => {
    navigate(`/workflows/${workflow.run_id}`);
  };

  const handleSortChange = (field: string, order?: "asc" | "desc") => {
    if (field === sortBy) {
      setSortOrder(order ?? (sortOrder === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(order || "desc");
    }
  };

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loading || fetchingMore) {
      return;
    }
    fetchWorkflows(page + 1, false);
  }, [hasMore, loading, fetchingMore, page, fetchWorkflows]);

  const handleWorkflowsDeleted = () => {
    fetchWorkflows(1, true);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Workflows"
        description="Grouped chains and workflow processes"
        filters={[
          {
            label: "Time Range",
            value: timeRange,
            options: TIME_FILTER_OPTIONS,
            onChange: (value) => setTimeRange(value),
          },
          {
            label: "Status",
            value: status,
            options: STATUS_FILTER_OPTIONS,
            onChange: (value) => setStatus(value),
          },
        ]}
      />

      <CompactWorkflowsTable
        workflows={workflows}
        loading={loading}
        hasMore={hasMore}
        isFetchingMore={fetchingMore}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        onLoadMore={handleLoadMore}
        onWorkflowClick={handleWorkflowClick}
        onWorkflowsDeleted={handleWorkflowsDeleted}
        onRefresh={() => fetchWorkflows(1, true)}
      />

      {error && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-8 text-center">
          <div className="text-red-600 mb-2">Error loading workflows</div>
          <div className="text-muted-foreground">{error}</div>
        </div>
      )}
    </div>
  );
}
