import {
  ArrowLeft,
  Play,
  Square,
  RotateCw,
  Settings,
  Activity,
  MessageSquare,
  ScrollText,
  Bot,
} from "lucide-react";

import { api } from "@/src/utils/api";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Skeleton } from "@/src/components/ui/skeleton";

import { BotBilling } from "./BotBilling";
import { BotChatWidget } from "./BotChatWidget";
import { BalanceBadge } from "./BalanceBadge";
import type { BotStatus } from "../types";
import { BOT_PLATFORM_PRICING } from "../types";

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

const logLevelColor: Record<string, string> = {
  info: "text-blue-600 dark:text-blue-400",
  warn: "text-yellow-600 dark:text-yellow-400",
  error: "text-red-600 dark:text-red-400",
  debug: "text-muted-foreground",
};

interface Props {
  projectId: string;
  botId: string;
  onBack: () => void;
}

export function BotDetail({ projectId, botId, onBack }: Props) {
  const utils = api.useUtils();

  const { data: bot, isLoading } = api.bots.getById.useQuery(
    { projectId, botId },
    { enabled: !!projectId && !!botId },
  );

  const { data: logs, isLoading: logsLoading } = api.bots.getLogs.useQuery(
    { projectId, botId, limit: 100 },
    { enabled: !!projectId && !!botId },
  );

  const { data: balance, isLoading: balanceLoading } =
    api.bots.getBalance.useQuery(
      { projectId },
      { enabled: !!projectId },
    );

  const hasCredit = (balance?.available ?? 0) > 0;

  const startMut = api.bots.start.useMutation({
    onSuccess: () => {
      utils.bots.getById.invalidate();
      utils.bots.list.invalidate();
      utils.bots.getBalance.invalidate();
    },
  });
  const stopMut = api.bots.stop.useMutation({
    onSuccess: () => {
      utils.bots.getById.invalidate();
      utils.bots.list.invalidate();
    },
  });
  const restartMut = api.bots.restart.useMutation({
    onSuccess: () => {
      utils.bots.getById.invalidate();
      utils.bots.list.invalidate();
      utils.bots.getBalance.invalidate();
    },
  });

  if (isLoading || !bot) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="bot-detail-view">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" data-testid="btn-back-to-dashboard" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {bot.name}
            </h1>
            <Badge variant="secondary" className={statusColor[bot.status]}>
              <span
                className={`mr-1.5 inline-block h-2 w-2 rounded-full ${statusDot[bot.status]}`}
              />
              {bot.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {bot.platform} / {bot.region} / {bot.instanceType}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {balance && (
            <BalanceBadge
              availableCents={balance?.available ?? 0}
              loading={balanceLoading}
            />
          )}
          {bot.status === "stopped" && (
            <Button
              size="sm"
              onClick={() => startMut.mutate({ projectId, botId })}
              disabled={startMut.isPending || !hasCredit}
              title={!hasCredit ? "Insufficient funds — add credits to continue" : undefined}
            >
              <Play className="mr-1 h-4 w-4" />
              Start
            </Button>
          )}
          {bot.status === "running" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stopMut.mutate({ projectId, botId })}
                disabled={stopMut.isPending}
              >
                <Square className="mr-1 h-4 w-4" />
                Stop
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => restartMut.mutate({ projectId, botId })}
                disabled={restartMut.isPending}
              >
                <RotateCw className="mr-1 h-4 w-4" />
                Restart
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="mr-1.5 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="chat">
            <Bot className="mr-1.5 h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="channels">
            <MessageSquare className="mr-1.5 h-4 w-4" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="logs">
            <ScrollText className="mr-1.5 h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="billing">
            <Settings className="mr-1.5 h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-1.5 h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {bot.memoryUsageMb} MB
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Messages (MTD)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {bot.monthlyUsage.messages.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tokens (MTD)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {bot.monthlyUsage.tokens.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Config summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <span className="text-muted-foreground">Bot ID</span>
                <span className="font-mono">{bot.id}</span>

                <span className="text-muted-foreground">Platform</span>
                <span className="capitalize">{bot.platform}</span>

                <span className="text-muted-foreground">Tier</span>
                <Badge variant="outline" className="w-fit capitalize">
                  {bot.tier}
                </Badge>

                <span className="text-muted-foreground">Region</span>
                <span className="font-mono">{bot.region}</span>

                <span className="text-muted-foreground">Instance Type</span>
                <span className="font-mono">{bot.instanceType}</span>

                <span className="text-muted-foreground">Created</span>
                <span>{new Date(bot.createdAt).toLocaleDateString()}</span>

                <span className="text-muted-foreground">Last Active</span>
                <span>{new Date(bot.lastActiveAt).toLocaleString()}</span>

                <span className="text-muted-foreground">Models</span>
                <div className="flex flex-wrap gap-1">
                  {bot.modelsEnabled.map((m) => (
                    <Badge key={m} variant="outline" className="font-mono text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat */}
        <TabsContent value="chat" className="mt-4">
          <BotChatWidget projectId={projectId} botId={botId} />
        </TabsContent>

        {/* Channels */}
        <TabsContent value="channels" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connected Channels</CardTitle>
            </CardHeader>
            <CardContent>
              {bot.channels.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No channels connected.
                </p>
              ) : (
                <div className="space-y-3">
                  {bot.channels.map((ch) => (
                    <div
                      key={ch}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium capitalize">{ch}</p>
                          <p className="text-xs text-muted-foreground">
                            Connected
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-green-500/15 text-green-700 dark:text-green-400"
                      >
                        Active
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Logs</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[80px]">Level</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-36" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-12" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : !logs || logs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No logs available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-xs">
                          {new Date(entry.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-xs font-medium uppercase ${logLevelColor[entry.level] ?? ""}`}
                          >
                            {entry.level}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.message}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="mt-4">
          <BotBilling projectId={projectId} botId={botId} />
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bot Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-y-3">
                  <span className="text-muted-foreground">
                    Base Platform Cost
                  </span>
                  <span className="font-medium">
                    ${BOT_PLATFORM_PRICING[bot.platform].price}/mo
                  </span>

                  <span className="text-muted-foreground">Auto-restart</span>
                  <span>Enabled</span>

                  <span className="text-muted-foreground">
                    Health Check Interval
                  </span>
                  <span>30s</span>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Full settings management will be available when the bot
                  backend is deployed. This is a preview of the configuration
                  surface.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
