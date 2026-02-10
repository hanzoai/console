import { Badge, StatusBadge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import type { ExecutionSummary } from '../types/executions';

interface ExecutionCardProps {
  execution: ExecutionSummary;
  onViewDetails?: (executionId: string) => void;
  compact?: boolean;
}

export function ExecutionCard({ execution, onViewDetails, compact = false }: ExecutionCardProps) {
  const getStatusVariant = (status: string): 'success' | 'failed' | 'running' | 'pending' | 'unknown' => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'failed';
      case 'running': return 'running';
      case 'pending': return 'pending';
      default: return 'unknown';
    }
  };

  const formatDuration = (durationMs?: number) => {
    if (!durationMs) return 'N/A';

    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    if (durationMs < 3600000) return `${(durationMs / 60000).toFixed(1)}m`;
    return `${(durationMs / 3600000).toFixed(1)}h`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
    if (diffMs < 604800000) return `${Math.floor(diffMs / 86400000)}d ago`;

    return date.toLocaleDateString();
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'N/A';

    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)}MB`;
    return `${(bytes / 1073741824).toFixed(1)}GB`;
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
        <div className="flex items-center space-x-3">
          <StatusBadge
            status={getStatusVariant(execution.status)}
            size="sm"
          >
            {execution.status}
          </StatusBadge>
          <div className="flex flex-col">
            <span className="font-medium text-sm">{execution.workflow_name || execution.workflow_id}</span>
            <span className="text-body-small">{execution.reasoner_id}</span>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-body-small">
          <span>{formatDuration(execution.duration_ms)}</span>
          <span>{formatTimestamp(execution.started_at || execution.created_at || '')}</span>
          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(execution.execution_id || execution.id?.toString() || '')}
              className="h-6 px-2 text-xs"
            >
              View
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <StatusBadge
              status={getStatusVariant(execution.status)}
              size="md"
            />
            {execution.workflow_tags && execution.workflow_tags.length > 0 && (
              <div className="flex space-x-1">
                {execution.workflow_tags.slice(0, 3).map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {execution.workflow_tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{execution.workflow_tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="text-right text-body-small">
            <div>{formatTimestamp(execution.started_at || execution.created_at || '')}</div>
            {execution.completed_at && (
              <div className="text-xs">
                Completed {formatTimestamp(execution.completed_at)}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-heading-3 mb-1">
              {execution.workflow_name || execution.workflow_id}
            </h3>
            <p className="text-body-small">
              Execution ID: <span className="font-mono">{execution.execution_id}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Agent</div>
              <div className="font-medium">{execution.agent_node_id}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Reasoner</div>
              <div className="font-medium">{execution.reasoner_id}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Duration</div>
              <div className="font-medium">{formatDuration(execution.duration_ms)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Data Size</div>
              <div className="font-medium">
                {formatSize(execution.input_size)} / {formatSize(execution.output_size)}
              </div>
            </div>
          </div>

          {execution.session_id && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {execution.session_id && (
                <div>
                  <div className="text-muted-foreground">Session</div>
                  <div className="font-mono text-xs">{execution.session_id}</div>
                </div>
              )}
            </div>
          )}

          {execution.error_message && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="text-red-800 font-medium text-sm mb-1">Error</div>
              <div className="text-red-700 text-sm font-mono">
                {execution.error_message}
              </div>
            </div>
          )}

          {onViewDetails && (
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(execution.execution_id || execution.id?.toString() || '')}
              >
                View Details
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
