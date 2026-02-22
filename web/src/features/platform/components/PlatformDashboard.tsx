import { useState } from "react";
import {
  Play,
  RotateCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Container,
  Activity,
  GitCommit,
  Rocket,
} from "lucide-react";

import { api } from "@/src/utils/api";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { Skeleton } from "@/src/components/ui/skeleton";

import type { PaasContainer, PipelineRun, PaasContainerStatus, PipelineRunStatus } from "../types";

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------

const containerStatusColor: Record<PaasContainerStatus, string> = {
  running: "bg-green-500/15 text-green-700 dark:text-green-400",
  stopped: "bg-muted text-muted-foreground",
  deploying: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  failed: "bg-destructive/15 text-destructive",
  unknown: "bg-muted text-muted-foreground",
};

const containerStatusDot: Record<PaasContainerStatus, string> = {
  running: "bg-green-500",
  stopped: "bg-muted-foreground",
  deploying: "bg-yellow-500 animate-pulse",
  failed: "bg-destructive",
  unknown: "bg-muted-foreground",
};

const pipelineStatusIcon: Record<PipelineRunStatus, typeof CheckCircle> = {
  success: CheckCircle,
  failure: XCircle,
  running: Loader2,
  pending: Clock,
  cancelled: XCircle,
};

const pipelineStatusColor: Record<PipelineRunStatus, string> = {
  success: "text-green-600 dark:text-green-400",
  failure: "text-destructive",
  running: "text-yellow-600 dark:text-yellow-400 animate-spin",
  pending: "text-muted-foreground",
  cancelled: "text-muted-foreground",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m ${remSec}s`;
}

// ---------------------------------------------------------------------------
// PipelineHistory sub-component
// ---------------------------------------------------------------------------

function PipelineHistory({
  projectId,
  containerId,
  containerName,
  onBack,
}: {
  projectId: string;
  containerId: string;
  containerName: string;
  onBack: () => void;
}) {
  const { data: pipelines, isLoading } = api.platform.listPipelines.useQuery(
    { projectId, containerId },
    { enabled: !!containerId },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <h2 className="text-lg font-semibold">Pipeline History: {containerName}</h2>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Commit</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !pipelines || pipelines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No pipeline runs found.
                  </TableCell>
                </TableRow>
              ) : (
                pipelines.map((run: PipelineRun) => {
                  const StatusIcon = pipelineStatusIcon[run.status];
                  return (
                    <TableRow key={run.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${pipelineStatusColor[run.status]}`} />
                          <span className="capitalize">{run.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{run.trigger ?? "manual"}</TableCell>
                      <TableCell>
                        {run.commitSha ? (
                          <div className="flex items-center gap-1">
                            <GitCommit className="h-3 w-3 text-muted-foreground" />
                            <code className="text-xs">{run.commitSha.slice(0, 7)}</code>
                            {run.commitMessage && (
                              <span className="ml-1 max-w-[200px] truncate text-xs text-muted-foreground">
                                {run.commitMessage}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatRelativeTime(run.startedAt)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {run.durationMs ? formatDuration(run.durationMs) : "-"}
                      </TableCell>
                      <TableCell>
                        {run.logsUrl && (
                          <a
                            href={run.logsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Logs
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlatformDashboard
// ---------------------------------------------------------------------------

export function PlatformDashboard({ projectId }: { projectId: string }) {
  const [selectedContainer, setSelectedContainer] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const utils = api.useUtils();
  const { data: containers, isLoading } = api.platform.listContainers.useQuery({ projectId }, { enabled: !!projectId });

  const triggerBuild = api.platform.triggerBuild.useMutation({
    onSuccess: () => utils.platform.listContainers.invalidate(),
  });

  // Aggregate stats
  const total = containers?.length ?? 0;
  const running = containers?.filter((c) => c.status === "running").length ?? 0;
  const deploying = containers?.filter((c) => c.status === "deploying").length ?? 0;
  const failed = containers?.filter((c) => c.status === "failed").length ?? 0;

  if (selectedContainer) {
    return (
      <PipelineHistory
        projectId={projectId}
        containerId={selectedContainer.id}
        containerName={selectedContainer.name}
        onBack={() => setSelectedContainer(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4" data-testid="platform-stats-grid">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Containers</CardTitle>
            <Container className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold">{total}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold">{running}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deploying</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold">{deploying}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold">{failed}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Container table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Image</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Replicas</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !containers || containers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                    data-testid="platform-empty-state"
                  >
                    No containers found. Configure PaaS credentials to see deployments.
                  </TableCell>
                </TableRow>
              ) : (
                containers.map((container: PaasContainer) => (
                  <TableRow
                    key={container.id}
                    className="cursor-pointer"
                    data-testid={`container-row-${container.id}`}
                    onClick={() =>
                      setSelectedContainer({
                        id: container.id,
                        name: container.name,
                      })
                    }
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{container.name}</span>
                        {container.domain && <span className="text-xs text-muted-foreground">{container.domain}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={containerStatusColor[container.status]}>
                        <span
                          className={`mr-1.5 inline-block h-2 w-2 rounded-full ${containerStatusDot[container.status]}`}
                        />
                        {container.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="max-w-[200px] truncate text-xs">
                        {container.image ? (container.image.split("/").pop()?.split(":")[0] ?? container.image) : "-"}
                      </code>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{container.region ?? "-"}</TableCell>
                    <TableCell className="text-center">{container.replicas ?? "-"}</TableCell>
                    <TableCell className="text-sm">{formatRelativeTime(container.updatedAt)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={triggerBuild.isPending}
                        onClick={() =>
                          triggerBuild.mutate({
                            projectId,
                            containerId: container.id,
                          })
                        }
                      >
                        {triggerBuild.isPending ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Rocket className="mr-1 h-3 w-3" />
                        )}
                        Deploy
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
