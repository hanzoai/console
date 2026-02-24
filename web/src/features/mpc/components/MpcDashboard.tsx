import { Wallet, Users, Clock, Activity, Plus, List, Settings, CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { Skeleton } from "@/src/components/ui/skeleton";

import { useMpcDashboard, useMpcWallets, useMpcHealth } from "../hooks";
import type { MpcWallet, MpcWalletStatus } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const walletStatusConfig: Record<MpcWalletStatus, { label: string; variant: "success" | "warning" | "secondary" }> = {
  active: { label: "Active", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  archived: { label: "Archived", variant: "secondary" },
};

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

type StatCardProps = {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  loading?: boolean;
};

function StatCard({ title, value, icon, loading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{value}</div>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// MpcDashboard
// ---------------------------------------------------------------------------

export function MpcDashboard({ projectId }: { projectId: string }) {
  const dashboardQuery = useMpcDashboard(projectId);
  const walletsQuery = useMpcWallets(projectId);
  const healthQuery = useMpcHealth();

  const summary = dashboardQuery.data;
  const wallets = walletsQuery.data?.data ?? [];
  const health = healthQuery.data;
  const base = `/project/${projectId}/mpc`;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Wallets"
          value={summary?.totalWallets ?? 0}
          icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
          loading={dashboardQuery.isPending}
        />
        <StatCard
          title="Active Signers"
          value={summary?.activeSigners ?? 0}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          loading={dashboardQuery.isPending}
        />
        <StatCard
          title="Signing Sessions (24h)"
          value={summary?.sessions24h ?? 0}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          loading={dashboardQuery.isPending}
        />
        <StatCard
          title="Avg Signing Latency"
          value={summary?.avgLatencyMs != null ? `${summary.avgLatencyMs}ms` : "--"}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          loading={dashboardQuery.isPending}
        />
      </div>

      {/* Wallets table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Wallets</h2>
          <Link href={`${base}/wallets`}>
            <Button variant="ghost" size="sm">
              View all
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Curve</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Signed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {walletsQuery.isPending ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : wallets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No wallets yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  wallets.slice(0, 5).map((w: MpcWallet) => {
                    const cfg = walletStatusConfig[w.status];
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="font-mono text-xs">{w.id.slice(0, 12)}...</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{w.curve}</Badge>
                        </TableCell>
                        <TableCell>
                          {w.threshold}/{w.parties}
                        </TableCell>
                        <TableCell className="text-sm">{formatRelativeTime(w.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {w.lastSignedAt ? formatRelativeTime(w.lastSignedAt) : "--"}
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

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Wallet
          </Button>
          <Link href={`${base}/sessions`}>
            <Button variant="outline">
              <List className="mr-2 h-4 w-4" />
              View Signing Sessions
            </Button>
          </Link>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Manage Threshold
          </Button>
        </div>
      </div>

      {/* Connection status */}
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          {healthQuery.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Checking connection to mpc.hanzo.ai...</span>
            </>
          ) : health?.status === "ok" ? (
            <>
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
              <span className="text-sm">
                Connected to <span className="font-mono text-xs">mpc.hanzo.ai</span>
              </span>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </>
          ) : (
            <>
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-destructive" />
              <span className="text-sm text-destructive">Unable to reach mpc.hanzo.ai</span>
              <XCircle className="h-4 w-4 text-destructive" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
