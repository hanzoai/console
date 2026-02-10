import { Analytics, CheckmarkFilled, ErrorFilled, InProgress } from '@/src/features/agents/components/ui/icon-bridge';
import { Badge } from './ui/badge';
import type { ExecutionStats } from '../types/executions';

interface ExecutionStatsCardProps {
  stats: ExecutionStats;
  className?: string;
}

export function ExecutionStatsCard({ stats, className = '' }: ExecutionStatsCardProps) {
  // Add null/undefined checks for all stats properties
  const totalExecutions = stats?.total_executions ?? 0;
  const successfulExecutions = stats?.successful_executions ?? stats?.successful_count ?? 0;
  const failedExecutions = stats?.failed_executions ?? stats?.failed_count ?? 0;
  const runningExecutions = stats?.running_executions ?? stats?.running_count ?? 0;

  const successRate = totalExecutions > 0
    ? ((successfulExecutions / totalExecutions) * 100).toFixed(1)
    : '0';

  const failureRate = totalExecutions > 0
    ? ((failedExecutions / totalExecutions) * 100).toFixed(1)
    : '0';

  return (
    <div className={`rounded-lg border bg-card p-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Executions */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
            <Analytics className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-small">Total Executions</p>
            <p className="text-heading-3">{totalExecutions.toLocaleString()}</p>
          </div>
        </div>

        {/* Successful Executions */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-100 dark:bg-green-900/20">
            <CheckmarkFilled className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-body-small">Successful</p>
              <Badge variant="outline" className="h-4 px-1.5 text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                {successRate}%
              </Badge>
            </div>
            <p className="text-heading-3 text-green-600 dark:text-green-400">
              {successfulExecutions.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Failed Executions */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/20">
            <ErrorFilled className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-body-small">Failed</p>
              <Badge variant="outline" className="h-4 px-1.5 text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                {failureRate}%
              </Badge>
            </div>
            <p className="text-heading-3 text-red-600 dark:text-red-400">
              {failedExecutions.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Running Executions */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/20">
            <InProgress className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-small">Currently Running</p>
            <p className="text-heading-3 text-blue-600 dark:text-blue-400">
              {runningExecutions.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
