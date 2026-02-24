import { Activity, Clock } from "lucide-react";

import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent } from "@/src/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { Skeleton } from "@/src/components/ui/skeleton";

import { useMpcSessions } from "../hooks";
import type { MpcSigningSession } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const sessionStatusConfig: Record<MpcSigningSession["status"], { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
  },
  signing: {
    label: "Signing",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  },
  completed: {
    label: "Completed",
    className: "bg-green-500/15 text-green-700 dark:text-green-400",
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/15 text-destructive",
  },
};

// ---------------------------------------------------------------------------
// MpcSessionsTable
// ---------------------------------------------------------------------------

export function MpcSessionsTable({ projectId }: { projectId: string }) {
  const sessionsQuery = useMpcSessions(projectId);
  const sessions = sessionsQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session ID</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Signers</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessionsQuery.isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sessionsQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-destructive">
                    Failed to load sessions: {sessionsQuery.error.message}
                  </TableCell>
                </TableRow>
              ) : sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No signing sessions yet.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((s: MpcSigningSession) => {
                  const cfg = sessionStatusConfig[s.status];
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.id.slice(0, 12)}...</TableCell>
                      <TableCell className="font-mono text-xs">{s.walletId.slice(0, 12)}...</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cfg.className}>
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.signers}/{s.requiredSigners}
                      </TableCell>
                      <TableCell>
                        {s.latencyMs != null ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {s.latencyMs}ms
                          </div>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(s.createdAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.completedAt ? formatDate(s.completedAt) : "--"}
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
