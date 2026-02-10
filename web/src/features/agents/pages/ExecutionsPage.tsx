import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "../adapters";
import {
  PageHeader,
  STATUS_FILTER_OPTIONS,
  TIME_FILTER_OPTIONS,
} from "../components/PageHeader";
import { CompactExecutionsTable } from "../components/CompactExecutionsTable";
import {
  getEnhancedExecutions,
  streamExecutionEvents,
} from "../services/executionsApi";
import type {
  EnhancedExecution,
  ExecutionViewFilters,
} from "../types/workflows";
import { getNextTimeRange } from "../lib/timeRanges";

const PAGE_SIZE = 100;

export function ExecutionsPage() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("24h");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("when");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [executions, setExecutions] = useState<EnhancedExecution[]>([]);
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

  const fetchExecutions = useCallback(
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

        const backendSort = sortBy === "when" ? "started_at" : sortBy;
        const response = await getEnhancedExecutions(
          filters,
          backendSort,
          sortOrder,
          targetPage,
          PAGE_SIZE,
          controller.signal
        );

        const nextExecutions = response.executions ?? [];

        if (reset && targetPage === 1 && nextExecutions.length === 0) {
          const broaderRange = getNextTimeRange(timeRange);
          if (broaderRange && broaderRange !== timeRange) {
            escalatedTimeRange = true;
            setTimeRange(broaderRange);
            return;
          }
        }

        setExecutions((prev) =>
          reset ? nextExecutions : [...prev, ...nextExecutions]
        );
        setHasMore(response.has_more ?? nextExecutions.length === PAGE_SIZE);
        setPage(targetPage);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch executions:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch executions"
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

  useEffect(() => {
    setExecutions([]);
    setPage(1);
    setHasMore(true);
    fetchExecutions(1, true);

    return () => {
      abortRef.current?.abort();
    };
  }, [filters, sortBy, sortOrder, timeRange]); // Use actual dependencies instead of fetchExecutions

  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = streamExecutionEvents();

      eventSource.onmessage = (event) => {
        if (!event.data || event.data.trim() === "") {
          return;
        }

        if (!event.data.trim().startsWith("{")) {
          return;
        }

        try {
          const executionEvent = JSON.parse(event.data);
          if (executionEvent.execution) {
            fetchExecutions(1, true);
          }
        } catch (err) {
          console.error("Failed to parse execution event:", err);
        }
      };

      eventSource.onerror = (event) => {
        console.error("Execution events stream error:", event);
      };
    } catch (err) {
      console.error("Failed to setup execution events stream:", err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only set up SSE once on mount

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
    fetchExecutions(page + 1, false);
  }, [hasMore, loading, fetchingMore, page, fetchExecutions]);

  const handleExecutionClick = (execution: EnhancedExecution) => {
    navigate(`/executions/${execution.execution_id}`);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Executions"
        description="Individual agent calls and execution history"
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-red-400 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-red-800">
              <h3 className="font-medium">Error loading executions</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={() => fetchExecutions(1, true)}
              className="ml-auto bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <CompactExecutionsTable
        executions={executions}
        loading={loading}
        hasMore={hasMore}
        isFetchingMore={fetchingMore}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        onLoadMore={handleLoadMore}
        onExecutionClick={handleExecutionClick}
        onRefresh={() => fetchExecutions(1, true)}
      />
    </div>
  );
}
