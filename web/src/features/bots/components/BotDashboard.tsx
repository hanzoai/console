import { useState } from "react";
import { useRouter } from "next/router";
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Plus,
  MessageSquare,
  Cpu,
  DollarSign,
} from "lucide-react";

import { api } from "@/src/utils/api";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Skeleton } from "@/src/components/ui/skeleton";

import { BotCreateDialog } from "./BotCreateDialog";
import { BotDetail } from "./BotDetail";
import type { Bot, BotStatus } from "../types";

const statusColor: Record<BotStatus, string> = {
  running: "bg-green-500/15 text-green-700 dark:text-green-400",
  stopped: "bg-muted text-muted-foreground",
  provisioning: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  error: "bg-destructive/15 text-destructive",
};

const statusDot: Record<BotStatus, string> = {
  running: "bg-green-500",
  stopped: "bg-muted-foreground",
  provisioning: "bg-yellow-500 animate-pulse",
  error: "bg-destructive",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function BotDashboard({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);

  const utils = api.useUtils();
  const { data: bots, isLoading } = api.bots.list.useQuery(
    { projectId },
    { enabled: !!projectId },
  );

  const startMut = api.bots.start.useMutation({
    onSuccess: () => utils.bots.list.invalidate(),
  });
  const stopMut = api.bots.stop.useMutation({
    onSuccess: () => utils.bots.list.invalidate(),
  });
  const restartMut = api.bots.restart.useMutation({
    onSuccess: () => utils.bots.list.invalidate(),
  });
  const deleteMut = api.bots.delete.useMutation({
    onSuccess: () => utils.bots.list.invalidate(),
  });

  // Aggregate stats
  const totalBots = bots?.length ?? 0;
  const runningBots = bots?.filter((b) => b.status === "running").length ?? 0;
  const totalMessages = bots?.reduce((s, b) => s + b.monthlyUsage.messages, 0) ?? 0;
  const totalCost = bots?.reduce((s, b) => s + b.monthlyUsage.cost, 0) ?? 0;

  if (selectedBotId) {
    return (
      <BotDetail
        projectId={projectId}
        botId={selectedBotId}
        onBack={() => setSelectedBotId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between" data-testid="bot-dashboard-header">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bots</h1>
          <p className="text-sm text-muted-foreground">
            Deploy and manage conversational bots across channels.
          </p>
        </div>
        <Button data-testid="btn-create-bot" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Bot
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4" data-testid="bot-stats-grid">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bots</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold">{totalBots}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold">{runningBots}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages (MTD)</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold">{formatNumber(totalMessages)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost (MTD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bot table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead className="text-right">Messages</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !bots || bots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground" data-testid="bot-empty-state">
                    No bots yet. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                bots.map((bot) => (
                  <TableRow
                    key={bot.id}
                    className="cursor-pointer"
                    data-testid={`bot-row-${bot.id}`}
                    onClick={() => setSelectedBotId(bot.id)}
                  >
                    <TableCell className="font-medium">{bot.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColor[bot.status]}>
                        <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${statusDot[bot.status]}`} />
                        {bot.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{bot.platform}</TableCell>
                    <TableCell className="font-mono text-xs">{bot.region}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {bot.channels.map((ch) => (
                          <Badge key={ch} variant="outline" className="text-xs capitalize">
                            {ch}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatNumber(bot.monthlyUsage.messages)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      ${bot.monthlyUsage.cost.toFixed(2)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <circle cx="12" cy="5" r="1" fill="currentColor" />
                              <circle cx="12" cy="12" r="1" fill="currentColor" />
                              <circle cx="12" cy="19" r="1" fill="currentColor" />
                            </svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {bot.status === "stopped" && (
                            <DropdownMenuItem
                              onClick={() =>
                                startMut.mutate({ projectId, botId: bot.id })
                              }
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Start
                            </DropdownMenuItem>
                          )}
                          {bot.status === "running" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  stopMut.mutate({ projectId, botId: bot.id })
                                }
                              >
                                <Square className="mr-2 h-4 w-4" />
                                Stop
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  restartMut.mutate({
                                    projectId,
                                    botId: bot.id,
                                  })
                                }
                              >
                                <RotateCw className="mr-2 h-4 w-4" />
                                Restart
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() =>
                              deleteMut.mutate({ projectId, botId: bot.id })
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BotCreateDialog
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
