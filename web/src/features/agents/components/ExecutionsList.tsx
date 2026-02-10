import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge, type BadgeProps } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ResponsiveGrid } from '@/src/features/agents/components/layout/ResponsiveGrid';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import {
  getExecutionsSummary,
  getExecutionStats,
  streamExecutionEvents,
  searchExecutions
} from '../services/executionsApi';
import type {
  ExecutionSummary,
  ExecutionStats,
  ExecutionFilters,
  ExecutionGrouping
} from '../types/executions';
import { statusTone } from '@/src/features/agents/lib/theme';
import { cn } from '@/src/features/agents/lib/utils';

type StatusVariant = NonNullable<BadgeProps["variant"]>;

const executionStatusVariantMap: Record<string, StatusVariant> = {
  completed: "success",
  success: "success",
  failed: "failed",
  error: "failed",
  running: "running",
  active: "running",
  pending: "pending",
  queued: "pending",
};

const getExecutionStatusVariant = (status: string | undefined | null): StatusVariant => {
  if (!status) return "unknown";
  const normalized = status.toLowerCase();
  return executionStatusVariantMap[normalized] ?? "unknown";
};

const formatStatusLabel = (status: string | undefined | null): string => {
  if (!status) return "Unknown";
  return status
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

interface ExecutionsListProps {
  initialFilters?: Partial<ExecutionFilters>;
  showStats?: boolean;
  showFilters?: boolean;
  title?: string;
  description?: string;
}

export function ExecutionsList({
  initialFilters = {},
  showStats = true,
  showFilters = true,
  title = "Execution Monitor",
  description = "Track and monitor all workflow executions across your agents"
}: ExecutionsListProps) {
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Partial<ExecutionFilters>>({
    page: 1,
    page_size: 20,
    ...initialFilters
  });
  const [pagination, setPagination] = useState({
    total_count: 0,
    page: 1,
    page_size: 20,
    total_pages: 0,
    has_next: false,
    has_prev: false
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [grouping] = useState<ExecutionGrouping>({
    group_by: 'none',
    sort_by: 'time',
    sort_order: 'desc'
  });

  const fetchExecutions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getExecutionsSummary(filters, grouping);

      if ('executions' in result) {
        // PaginatedExecutions
        setExecutions(result.executions);
        setPagination({
          total_count: result.total_count || result.total || 0,
          page: result.page,
          page_size: result.page_size,
          total_pages: result.total_pages,
          has_next: result.has_next || false,
          has_prev: result.has_prev || false
        });
      } else {
        // GroupedExecutions - flatten for now, we'll handle grouping in a separate component
        const flatExecutions = result.groups?.flatMap(group => group.executions) || [];
        setExecutions(flatExecutions);
        setPagination({
          total_count: result.total_count || 0,
          page: result.page,
          page_size: result.page_size,
          total_pages: result.total_pages,
          has_next: result.has_next || false,
          has_prev: result.has_prev || false
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch executions');
    } finally {
      setLoading(false);
    }
  }, [filters, grouping]);

  const fetchStats = useCallback(async () => {
    if (!showStats) return;

    try {
      const statsData = await getExecutionStats(filters);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch execution stats:', err);
    }
  }, [filters, showStats]);

  useEffect(() => {
    fetchExecutions();
    fetchStats();
  }, [fetchExecutions, fetchStats]);

  // Set up real-time updates with error handling
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = streamExecutionEvents();

      eventSource.onmessage = (event) => {
        try {
          const executionEvent = JSON.parse(event.data);

          // Update executions list based on event type
          setExecutions(prev => {
            if (!executionEvent.execution) return prev;

            const executionId = executionEvent.execution.execution_id || executionEvent.execution.id?.toString();
            const existingIndex = prev.findIndex(e => (e.execution_id || e.id?.toString()) === executionId);

            if (existingIndex >= 0) {
              // Update existing execution
              const updated = [...prev];
              updated[existingIndex] = executionEvent.execution;
              return updated;
            } else if (executionEvent.type === 'execution_started') {
              // Add new execution to the beginning
              return [executionEvent.execution, ...prev];
            }

            return prev;
          });

          // Refresh stats
          fetchStats();
        } catch (err) {
          console.error('Failed to parse execution event:', err);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Execution events stream error:', error);
      };
    } catch (err) {
      console.error('Failed to setup execution events stream:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [fetchStats]);

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (term.trim()) {
      try {
        setLoading(true);
        const result = await searchExecutions(term, filters);
        setExecutions(result.executions);
        setPagination({
          total_count: result.total_count || result.total || 0,
          page: result.page,
          page_size: result.page_size,
          total_pages: result.total_pages,
          has_next: result.has_next || false,
          has_prev: result.has_prev || false
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    } else {
      fetchExecutions();
    }
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  if (error) {
    return (
      <Card className={cn(statusTone.error.bg, statusTone.error.border)}>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className={cn("font-medium mb-2", statusTone.error.accent)}>Error Loading Executions</div>
            <div className={cn("text-sm mb-4", statusTone.error.fg)}>{error}</div>
            <Button onClick={fetchExecutions} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-display">{title}</h1>
        <p className="text-body">{description}</p>
      </div>

      {/* Stats Cards */}
      {showStats && stats && (
        <Card>
          <CardHeader>
            <CardTitle>Execution Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveGrid columns={{ base: 1, md: 2, lg: 4 }} gap="md" align="start">
              <div className="text-center">
                <div className="text-heading-1">{stats.total_executions}</div>
                <div className="text-body-small">Total</div>
              </div>
              <div className="text-center">
                <div className={cn("text-heading-1", statusTone.success.accent)}>
                  {stats.successful_executions}
                </div>
                <div className="text-body-small">Successful</div>
              </div>
              <div className="text-center">
                <div className={cn("text-heading-1", statusTone.error.accent)}>
                  {stats.failed_executions}
                </div>
                <div className="text-body-small">Failed</div>
              </div>
              <div className="text-center">
                <div className={cn("text-heading-1", statusTone.info.accent)}>
                  {stats.running_executions}
                </div>
                <div className="text-body-small">Running</div>
              </div>
            </ResponsiveGrid>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Search Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Search executions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button onClick={() => handleSearch(searchTerm)}>
                Search
              </Button>
              {searchTerm && (
                <Button variant="outline" onClick={() => handleSearch('')}>
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Executions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Executions</CardTitle>
              <CardDescription>
                {pagination.total_count} total executions
                {searchTerm && ` matching "${searchTerm}"`}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              Page {pagination.page} of {pagination.total_pages}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  {i < 4 && <Separator className="my-4" />}
                </div>
              ))}
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground mb-2">No executions found</div>
              <div className="text-body-small">
                {searchTerm ? 'Try adjusting your search terms' : 'Executions will appear here as they run'}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {executions.map((execution, index) => {
                const executionId = execution.execution_id || execution.id?.toString() || 'Unknown';
                const startedAt = execution.started_at || execution.created_at;
                return (
                  <div key={executionId}>
                    <Card className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">{executionId}</h3>
                            <Badge variant={getExecutionStatusVariant(execution.status)}>
                              {formatStatusLabel(execution.status)}
                            </Badge>
                          </div>
                          <div className="text-body-small space-y-1">
                            {execution.workflow_id && (
                              <div>Workflow: {execution.workflow_id}</div>
                            )}
                            {execution.session_id && (
                              <div>Session: {execution.session_id}</div>
                            )}
                            {execution.agent_node_id && (
                              <div>Agent: {execution.agent_node_id}</div>
                            )}
                            <div>Started: {startedAt ? (() => {
                              const date = new Date(startedAt);
                              return !isNaN(date.getTime()) ? date.toLocaleString() : 'Invalid Date';
                            })() : 'N/A'}</div>
                            {execution.completed_at && (() => {
                              const date = new Date(execution.completed_at);
                              return !isNaN(date.getTime()) ? (
                                <div>Ended: {date.toLocaleString()}</div>
                              ) : (
                                <div>Ended: Invalid Date</div>
                              );
                            })()}
                            {execution.duration_ms && (
                              <div>Duration: {execution.duration_ms}ms</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                    {index < executions.length - 1 && <Separator className="my-4" />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-body-small">
                Showing {((pagination.page - 1) * pagination.page_size) + 1} to{' '}
                {Math.min(pagination.page * pagination.page_size, pagination.total_count)} of{' '}
                {pagination.total_count} executions
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.has_prev}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.has_next}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
