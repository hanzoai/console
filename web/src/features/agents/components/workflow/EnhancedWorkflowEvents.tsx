import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { TagBadge } from "../notes/TagBadge";
import { getExecutionNotes } from "../../services/executionsApi";
import type { ExecutionNote } from "../../types/notes";
import type { WorkflowSummary, WorkflowTimelineNode } from "../../types/workflows";
import { normalizeExecutionStatus, getStatusLabel } from "../../utils/status";
import { Database, RefreshCw, Loader2, Clock, ArrowUpDown } from "@/src/features/agents/components/ui/icon-bridge";
import { cn } from "../../lib/utils";

interface EnhancedWorkflowEventsProps {
  workflow: WorkflowSummary;
  dagData?: { timeline?: WorkflowTimelineNode[] } | null;
  selectedNodeIds: string[];
  onNodeSelection: (nodeIds: string[], replace?: boolean) => void;
}

interface EventWithNotes extends WorkflowTimelineNode {
  notes: ExecutionNote[];
}

type TimeRange = 'all' | '1h' | '24h' | '7d';

const TIME_RANGE_THRESHOLD: Record<Exclude<TimeRange, 'all'>, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

const formatDuration = (durationMs?: number) => {
  if (!durationMs) return '—';
  if (durationMs < 1000) return `${durationMs} ms`;
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)} s`;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return '—';
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
};

export function EnhancedWorkflowEvents({
  dagData,
  selectedNodeIds,
  onNodeSelection,
}: EnhancedWorkflowEventsProps) {
  const [events, setEvents] = useState<EventWithNotes[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchVersion, setFetchVersion] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [onlySelected, setOnlySelected] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, Set<number>>>({});

  const timelineNodes: WorkflowTimelineNode[] = useMemo(() => {
    return dagData?.timeline ?? [];
  }, [dagData?.timeline]);

  useEffect(() => {
    let cancelled = false;

    const fetchNotes = async () => {
      if (!timelineNodes.length) {
        setEvents([]);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const notePromises = timelineNodes.map(async (node) => {
          try {
            const response = await getExecutionNotes(node.execution_id, {});
            return { ...node, notes: response.notes || [] } as EventWithNotes;
          } catch (err) {
            console.warn(`Failed to fetch notes for execution ${node.execution_id}:`, err);
            return { ...node, notes: [] } as EventWithNotes;
          }
        });

        const results = await Promise.all(notePromises);
        if (!cancelled) {
          setEvents(results);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load workflow events');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchNotes();

    return () => {
      cancelled = true;
    };
  }, [timelineNodes, fetchVersion]);

  useEffect(() => {
    if (onlySelected && selectedNodeIds.length === 0) {
      setOnlySelected(false);
    }
  }, [onlySelected, selectedNodeIds.length]);

  const availableStatuses = useMemo(() => {
    const statusSet = new Set<string>();
    events.forEach((event) => {
      statusSet.add(normalizeExecutionStatus(event.status));
    });
    return Array.from(statusSet).sort();
  }, [events]);

  const availableTags = useMemo(() => {
    const tagMap = new Map<string, string>();
    events.forEach((event) => {
      event.notes.forEach((note) => {
        note.tags.forEach((tag) => {
          const key = tag.toLowerCase();
          if (!tagMap.has(key)) {
            tagMap.set(key, tag);
          }
        });
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const searchableQuery = searchQuery.trim().toLowerCase();

  const filteredEvents = useMemo(() => {
    const now = Date.now();

    return events
      .filter((event) => {
        if (onlySelected && !selectedNodeIds.includes(event.execution_id)) {
          return false;
        }

        if (statusFilters.size) {
          const normalized = normalizeExecutionStatus(event.status);
          if (!statusFilters.has(normalized)) {
            return false;
          }
        }

        if (tagFilters.size) {
          const hasTag = event.notes.some((note) =>
            note.tags.some((tag) => tagFilters.has(tag.toLowerCase()))
          );
          if (!hasTag) {
            return false;
          }
        }

        if (timeRange !== 'all') {
          const threshold = TIME_RANGE_THRESHOLD[timeRange]
            || TIME_RANGE_THRESHOLD['24h'];
          const started = new Date(event.started_at).getTime();
          if (!Number.isFinite(started) || now - started > threshold) {
            return false;
          }
        }

        if (searchableQuery) {
          const baseText = [
            event.agent_name,
            event.reasoner_id,
            event.execution_id,
            event.status,
          ]
            .join(' ')
            .toLowerCase();

          const notesText = event.notes
            .map((note) => `${note.message} ${note.tags.join(' ')}`)
            .join(' ')
            .toLowerCase();

          if (!(baseText + ' ' + notesText).includes(searchableQuery)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.started_at).getTime();
        const timeB = new Date(b.started_at).getTime();
        if (!Number.isFinite(timeA) || !Number.isFinite(timeB)) {
          return 0;
        }
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      });
  }, [
    events,
    onlySelected,
    selectedNodeIds,
    statusFilters,
    tagFilters,
    timeRange,
    searchableQuery,
    sortOrder,
  ]);

  const toggleStatusFilter = useCallback((status: string) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const toggleTagFilter = useCallback((tag: string) => {
    const key = tag.toLowerCase();
    setTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleNoteExpansion = useCallback((executionId: string, noteIndex: number) => {
    setExpandedNotes((prev) => {
      const existing = prev[executionId] ? new Set(prev[executionId]) : new Set<number>();
      if (existing.has(noteIndex)) {
        existing.delete(noteIndex);
      } else {
        existing.add(noteIndex);
      }
      return { ...prev, [executionId]: existing };
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setFetchVersion((version) => version + 1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setTimeRange('all');
    setStatusFilters(new Set());
    setTagFilters(new Set());
    setSortOrder('desc');
    setOnlySelected(false);
  }, []);

  const filtersActive =
    Boolean(searchQuery) ||
    timeRange !== 'all' ||
    statusFilters.size > 0 ||
    tagFilters.size > 0 ||
    onlySelected;

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search by agent, reasoner, execution, or note content"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-72"
          />
          <div className="flex items-center gap-1">
            {(['all', '1h', '24h', '7d'] as TimeRange[]).map((range) => (
              <Button
                key={range}
                size="sm"
                variant={timeRange === range ? 'default' : 'outline'}
                onClick={() => setTimeRange(range)}
              >
                {range === 'all' && 'All time'}
                {range === '1h' && 'Last hour'}
                {range === '24h' && '24 hours'}
                {range === '7d' && '7 days'}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          >
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {filteredEvents.length} / {events.length} events
          </Badge>
          <Button
            variant={onlySelected ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlySelected((prev) => !prev)}
            disabled={selectedNodeIds.length === 0}
          >
            Selected
          </Button>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {(availableStatuses.length > 0 || availableTags.length > 0) && (
        <div className="space-y-2 px-4 py-3 border-b border-border bg-muted/10">
          {availableStatuses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Statuses</span>
              {availableStatuses.map((status) => {
                const label = getStatusLabel(status);
                const active = statusFilters.has(status);
                return (
                  <Button
                    key={status}
                    variant={active ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleStatusFilter(status)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          )}

          {availableTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Tags</span>
              {availableTags.map((tag) => (
                <TagBadge
                  key={tag}
                  tag={tag}
                  size="sm"
                  onClick={() => toggleTagFilter(tag)}
                  className={`cursor-pointer transition-opacity ${
                    tagFilters.has(tag.toLowerCase()) ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading workflow events…
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <p className="text-body-small">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && filteredEvents.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 text-muted-foreground">
            <Database className="h-10 w-10" />
            <div className="space-y-1">
              <p className="text-sm">No workflow events match the current filters.</p>
              <p className="text-xs">Adjust your filters or clear them to see all events.</p>
            </div>
          </div>
        )}

        {!loading && !error && filteredEvents.length > 0 && (
          <div className="space-y-3 px-4 py-4">
            {filteredEvents.map((event) => {
              const normalizedStatus = normalizeExecutionStatus(event.status);
              const statusLabel = getStatusLabel(normalizedStatus);
              const isSelected = selectedNodeIds.includes(event.execution_id);
              const eventExpandedNotes = expandedNotes[event.execution_id];

              const cardClasses = cn(
                "rounded-lg border border-border/60 bg-muted/15 p-4 transition-colors",
                isSelected && "border-primary/40 bg-primary/5 shadow-sm"
              );

              return (
                <div key={event.execution_id} className={cardClasses}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          {event.agent_name || event.reasoner_id || 'Workflow step'}
                        </h3>
                        <Badge variant="outline" className="text-body-small uppercase tracking-wide">
                          {statusLabel}
                        </Badge>
                        {isSelected && (
                          <Badge variant="secondary" className="text-body-small uppercase tracking-wide">
                            Selected
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-body-small">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(event.started_at)}
                        </span>
                        <span>Duration {formatDuration(event.duration_ms)}</span>
                        {typeof event.workflow_depth === 'number' && (
                          <span>Depth {event.workflow_depth}</span>
                        )}
                        <span className="font-mono text-muted-foreground/80">
                          {event.execution_id}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {event.notes.length} note{event.notes.length === 1 ? '' : 's'}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNodeSelection([event.execution_id], true)}
                      >
                        Focus
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {event.notes.length === 0 ? (
                      <p className="text-body-small italic">
                        No notes have been captured for this step yet.
                      </p>
                    ) : (
                      event.notes.map((note, index) => {
                        const needsToggle = note.message.length > 260;
                        const isExpanded = eventExpandedNotes?.has(index) ?? false;
                        const displayMessage = needsToggle && !isExpanded
                          ? `${note.message.slice(0, 260)}…`
                          : note.message;

                        return (
                          <div
                            key={`${note.timestamp}-${index}`}
                            className="rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                          >
                            <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                              {displayMessage}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-body-small">
                              <span>{formatTimestamp(note.timestamp)}</span>
                              {note.tags.map((tag) => (
                                <TagBadge
                                  key={`${tag}-${index}`}
                                  tag={tag}
                                  size="sm"
                                  onClick={() => toggleTagFilter(tag)}
                                  className={`cursor-pointer transition-opacity ${
                                    tagFilters.has(tag.toLowerCase())
                                      ? 'opacity-100'
                                      : 'opacity-75 hover:opacity-100'
                                  }`}
                                />
                              ))}
                              {needsToggle && (
                                <button
                                  onClick={() => toggleNoteExpansion(event.execution_id, index)}
                                  className="ml-auto text-xs text-primary hover:underline"
                                >
                                  {isExpanded ? 'Show less' : 'Show more'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
