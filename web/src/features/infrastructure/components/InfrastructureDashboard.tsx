import {
  Server,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  GitCommit,
  Clock,
  Cpu,
  MemoryStick,
} from "lucide-react";

import { api } from "@/src/utils/api";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { Skeleton } from "@/src/components/ui/skeleton";

import type { ServiceHealth, ServiceHealthStatus, DeploymentEvent } from "../types";

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------

const healthStatusConfig: Record<
  ServiceHealthStatus,
  { icon: typeof CheckCircle; color: string; bg: string; dot: string; label: string }
> = {
  healthy: {
    icon: CheckCircle,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    dot: "bg-green-500",
    label: "Healthy",
  },
  degraded: {
    icon: AlertTriangle,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    dot: "bg-yellow-500 animate-pulse",
    label: "Degraded",
  },
  down: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10 border-destructive/20",
    dot: "bg-destructive",
    label: "Down",
  },
  unknown: {
    icon: HelpCircle,
    color: "text-muted-foreground",
    bg: "bg-muted border-muted-foreground/20",
    dot: "bg-muted-foreground",
    label: "Unknown",
  },
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

function formatMemory(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
  return `${Math.round(mb)}MB`;
}

function memoryUsagePercent(used?: number, limit?: number): number | undefined {
  if (used === undefined || limit === undefined || limit === 0) return undefined;
  return (used / limit) * 100;
}

// ---------------------------------------------------------------------------
// ServiceCard
// ---------------------------------------------------------------------------

function ServiceCard({ service }: { service: ServiceHealth }) {
  const config = healthStatusConfig[service.status];
  const StatusIcon = config.icon;
  const memPct = memoryUsagePercent(service.memory, service.memoryLimit);
  const memWarning = memPct !== undefined && memPct > 80;

  return (
    <Card className={`border ${config.bg}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${config.dot}`} />
              <h3 className="font-semibold">{service.name}</h3>
            </div>
            {service.domain && <p className="text-xs text-muted-foreground">{service.domain}</p>}
          </div>
          <StatusIcon className={`h-5 w-5 ${config.color}`} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {service.replicas !== undefined && (
            <div className="flex items-center gap-1">
              <Server className="h-3 w-3 text-muted-foreground" />
              <span>
                {service.readyReplicas ?? service.replicas}/{service.replicas} replicas
              </span>
            </div>
          )}
          {service.cpu !== undefined && (
            <div className="flex items-center gap-1">
              <Cpu className="h-3 w-3 text-muted-foreground" />
              <span>{service.cpu}m CPU</span>
            </div>
          )}
          {service.memory !== undefined && (
            <div className="flex items-center gap-1">
              <MemoryStick className={`h-3 w-3 ${memWarning ? "text-yellow-500" : "text-muted-foreground"}`} />
              <span className={memWarning ? "font-medium text-yellow-600 dark:text-yellow-400" : ""}>
                {formatMemory(service.memory)}
                {service.memoryLimit ? ` / ${formatMemory(service.memoryLimit)}` : ""}
                {memPct !== undefined && ` (${memPct.toFixed(0)}%)`}
              </span>
            </div>
          )}
          {service.region && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Region:</span>
              <span className="font-mono">{service.region}</span>
            </div>
          )}
        </div>

        <div className="mt-2 text-xs text-muted-foreground">Updated {formatRelativeTime(service.updatedAt)}</div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// InfrastructureDashboard
// ---------------------------------------------------------------------------

export function InfrastructureDashboard({ projectId }: { projectId: string }) {
  const { data: services, isLoading: servicesLoading } = api.infrastructure.getServiceHealth.useQuery(
    { projectId },
    {
      enabled: !!projectId,
      refetchInterval: 30000,
    },
  );

  const { data: events, isLoading: eventsLoading } = api.infrastructure.getDeploymentEvents.useQuery(
    { projectId },
    {
      enabled: !!projectId,
      refetchInterval: 60000,
    },
  );

  const healthy = services?.filter((s) => s.status === "healthy").length ?? 0;
  const degraded = services?.filter((s) => s.status === "degraded").length ?? 0;
  const down = services?.filter((s) => s.status === "down").length ?? 0;
  const total = services?.length ?? 0;

  const memWarnings =
    services?.filter((s) => {
      const pct = memoryUsagePercent(s.memory, s.memoryLimit);
      return pct !== undefined && pct > 80;
    }) ?? [];

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-4" data-testid="infra-stats-grid">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {servicesLoading ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold">{total}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Healthy</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {servicesLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{healthy}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Degraded</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {servicesLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{degraded}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Down</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {servicesLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold text-destructive">{down}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Memory warnings */}
      {memWarnings.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              Memory Pressure Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {memWarnings.map((s) => {
                const pct = memoryUsagePercent(s.memory, s.memoryLimit);
                return (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.name}</span>
                    <span className="font-mono text-xs text-yellow-700 dark:text-yellow-400">
                      {s.memory !== undefined && formatMemory(s.memory)} /{" "}
                      {s.memoryLimit !== undefined && formatMemory(s.memoryLimit)} ({pct?.toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service health grid */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Service Health</h2>
        {servicesLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="mb-2 h-5 w-32" />
                  <Skeleton className="mb-1 h-4 w-24" />
                  <Skeleton className="h-4 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !services || services.length === 0 ? (
          <Card>
            <CardContent className="flex h-24 items-center justify-center text-muted-foreground">
              No services found. Configure PaaS credentials to monitor infrastructure.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service: ServiceHealth) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>

      {/* Recent deployment events */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent Deployments</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !events || events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No recent deployment events.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event: DeploymentEvent) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.serviceName}</TableCell>
                      <TableCell className="capitalize">{event.event}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            event.status.includes("success")
                              ? "bg-green-500/15 text-green-700 dark:text-green-400"
                              : event.status.includes("fail") || event.status.includes("error")
                                ? "bg-destructive/15 text-destructive"
                                : "bg-muted text-muted-foreground"
                          }
                        >
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {event.commitSha ? (
                          <div className="flex items-center gap-1">
                            <GitCommit className="h-3 w-3 text-muted-foreground" />
                            <code className="text-xs">{event.commitSha.slice(0, 7)}</code>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatRelativeTime(event.timestamp)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
