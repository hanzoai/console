import {
  Activity,
  Blocks,
  ArrowUpRight,
  ExternalLink,
  Clock,
  Hash,
  Users,
  Gauge,
  CheckCircle,
  XCircle,
} from "lucide-react";

import { api } from "@/src/utils/api";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";

import type { ChainNetwork, ChainStats, IndexerHealth } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPLORER_URLS: Record<ChainNetwork, string> = {
  mainnet: "https://explore.lux.network",
  testnet: "https://explore-test.lux.network",
  devnet: "https://explore-dev.lux.network",
};

const networkLabel: Record<ChainNetwork, string> = {
  mainnet: "Mainnet",
  testnet: "Testnet",
  devnet: "Devnet",
};

const networkBadgeColor: Record<ChainNetwork, string> = {
  mainnet: "bg-green-500/15 text-green-700 dark:text-green-400",
  testnet: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  devnet: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: string | number): string {
  const num = typeof n === "string" ? parseInt(n, 10) : n;
  if (isNaN(num)) return "0";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

// ---------------------------------------------------------------------------
// NetworkCard
// ---------------------------------------------------------------------------

function NetworkCard({ stats, health, isLoading }: { stats?: ChainStats; health?: IndexerHealth; isLoading: boolean }) {
  const network = stats?.network ?? health?.network ?? "mainnet";

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{networkLabel[network]}</CardTitle>
            <Badge variant="secondary" className={networkBadgeColor[network]}>
              {network}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {health && (
              <div className="flex items-center gap-1">
                {health.healthy ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-xs text-muted-foreground">{health.healthy ? "Synced" : "Offline"}</span>
              </div>
            )}
            <a href={EXPLORER_URLS[network]} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2">
                <ExternalLink className="h-3 w-3" />
                <span className="text-xs">Explore</span>
              </Button>
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {/* Block Height */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Blocks className="h-3 w-3" />
              Blocks
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <p className="text-xl font-bold">{stats ? formatNumber(stats.totalBlocks) : "-"}</p>
            )}
          </div>

          {/* Transactions */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowUpRight className="h-3 w-3" />
              Transactions
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <p className="text-xl font-bold">{stats ? formatNumber(stats.totalTransactions) : "-"}</p>
            )}
          </div>

          {/* Addresses */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              Addresses
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <p className="text-xl font-bold">{stats?.totalAddresses ? formatNumber(stats.totalAddresses) : "-"}</p>
            )}
          </div>

          {/* Block Time / Utilization */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Block Time
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <p className="text-xl font-bold">
                {stats?.averageBlockTime ? `${stats.averageBlockTime.toFixed(1)}s` : "-"}
              </p>
            )}
          </div>
        </div>

        {/* Health bar */}
        {health && (
          <div className="mt-4 flex items-center gap-3 rounded-md border p-2 text-xs">
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Indexer</span>
            </div>
            <div className="flex items-center gap-1">
              <Hash className="h-3 w-3 text-muted-foreground" />
              <span>{health.latestBlockNumber ? `Block #${formatNumber(health.latestBlockNumber)}` : "N/A"}</span>
            </div>
            <div className="flex items-center gap-1">
              <Gauge className="h-3 w-3 text-muted-foreground" />
              <span>{health.responseTimeMs}ms</span>
            </div>
            {health.networkUtilization !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Utilization:</span>
                <span>{(health.networkUtilization * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ExplorerDashboard
// ---------------------------------------------------------------------------

export function ExplorerDashboard({ projectId }: { projectId: string }) {
  const { data: allStats, isLoading: statsLoading } = api.explorer.getAllStats.useQuery(
    { projectId },
    {
      enabled: !!projectId,
      refetchInterval: 60000, // refresh every 60s
    },
  );

  const { data: healthData, isLoading: healthLoading } = api.explorer.getHealth.useQuery(
    { projectId },
    {
      enabled: !!projectId,
      refetchInterval: 30000, // refresh every 30s
    },
  );

  const isLoading = statsLoading || healthLoading;
  const networks: ChainNetwork[] = ["mainnet", "testnet", "devnet"];

  // Aggregate stats
  const totalBlocks = allStats?.reduce((sum, s) => sum + parseInt(s.totalBlocks, 10), 0) ?? 0;
  const totalTxns = allStats?.reduce((sum, s) => sum + parseInt(s.totalTransactions, 10), 0) ?? 0;
  const healthyCount = healthData?.filter((h) => h.healthy).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3" data-testid="explorer-stats-grid">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Blocks</CardTitle>
            <Blocks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">{formatNumber(totalBlocks)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">{formatNumber(totalTxns)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Networks Online</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold">
                {healthyCount}/{networks.length}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-network cards */}
      <div className="space-y-4">
        {networks.map((network) => {
          const stats = allStats?.find((s) => s.network === network);
          const health = healthData?.find((h) => h.network === network);
          return <NetworkCard key={network} stats={stats} health={health} isLoading={isLoading} />;
        })}
      </div>
    </div>
  );
}
