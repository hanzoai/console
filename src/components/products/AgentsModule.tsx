'use client'

/**
 * Agents — the autonomous-agent dashboard (AI / Automation). A rich, at-a-glance
 * board over the REAL agent registry (`AgentsApi.list` → the user-bearer
 * `/v1/agents` proxy, org-scoped server-side): five headline stat cards, an
 * invocations-over-time area chart, an agent-health donut, the agents table
 * (status tabs + pagination), a recent-activity feed, a top-agents bar list, and a
 * 30-day resource-usage panel.
 *
 * Honest by construction — EVERY number is real or derived from real rows
 * (`deriveAgentStats`, `healthBreakdown`, `topByInvocations`, `deriveActivity`); a
 * metric no row carries reads "—". The chart + resource panel read the time-series
 * facade (`AgentsApi.metrics`); until that route is bound they show a truthful "not
 * connected" note, never a placeholder trend. When the org has ZERO agents (or the
 * `/v1/agents` route isn't bound yet) the board is replaced by a polished
 * "create your first agent" empty state that opens the QUICKSTART — the one way to
 * create an agent here — never the mockup's sample data.
 *
 * Style props use the @hanzo/gui v5 shorthand set (bg/p/px/py/gap/rounded/items/…).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Input, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import { useAnalytics } from '@hanzo/event/react'
import { EVENTS } from '@hanzo/event'
import {
  Activity,
  Bot,
  ChevronLeft,
  ChevronRight,
  Gauge,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Timer,
  Trash2,
  Zap,
} from '@hanzogui/lucide-icons-2'

import { config } from '~/config'
import {
  AgentsApi,
  deriveActivity,
  deriveAgentStats,
  filterAgents,
  fmtCompact,
  fmtDuration,
  fmtInt,
  fmtPct,
  fmtRelative,
  healthBreakdown,
  paginate,
  summedSeries,
  topByInvocations,
  trendPct,
  AGENT_STATUSES,
  AGENT_STATUS_LABEL,
  METRICS_RANGES,
  type Agent,
  type AgentActivity,
  type AgentsMetrics,
  type AgentStatus,
  type MetricsRange,
} from '~/lib/api/agents'
import { productColorHex } from '~/lib/products/colors'
import { LineChart, Sparkline, type ChartPoint } from '~/components/ui/Charts'
import { useDetailPane } from '~/components/DetailPane'
import { MetricCard, Delta } from './functions/parts'
import {
  AgentAvatar,
  ActivityFeed,
  HealthDonut,
  Panel,
  ResourceUsagePanel,
  StatusPill,
  TopAgents,
  VersionBadge,
} from './agents/parts'
import { AgentDetailView } from './agents/forms'
import { agentBuilderLoaders } from './agents/loaders'
import { AgentQuickstart } from '~/components/agent-builder'
import { BackendStateCard, DataTable, EmptyState, PageHeader, classifyBackend, type BackendState, type Column } from '@hanzo/ui/product'

const PAGE_SIZE = 8
const DASH = '—'
const DOCS = `${config.docsUrl}/docs/agents`

type StatusTab = AgentStatus | 'all'

/** Compact bucket label from a loose timestamp (month/day/hour). */
function bucketLabel(t: string): string {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return t
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' })
}

/** Load the registry once; `live` = it loaded over a real 200 (gates mutations). */
function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<BackendState | null>(null)
  const [live, setLive] = useState(false)
  const [activity, setActivity] = useState<AgentActivity[]>([])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const list = await AgentsApi.list()
      setAgents(list)
      setLive(true)
      setError(null)
      // Prefer a real activity feed; fall back to the agents' own timestamps.
      try {
        const feed = await AgentsApi.activity()
        setActivity(feed.length ? feed : deriveActivity(list))
      } catch {
        setActivity(deriveActivity(list))
      }
    } catch (e) {
      setAgents([])
      setLive(false)
      setActivity([])
      setError(classifyBackend(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { agents, loading, error, live, activity, reload, setAgents }
}

export function AgentsModule(props: { params: Record<string, string> }) {
  const router = useRouter()
  const detail = useDetailPane()
  const { agents, loading, error, live, activity, reload, setAgents } = useAgents()

  const [range, setRange] = useState<MetricsRange>('30D')
  const [metrics, setMetrics] = useState<AgentsMetrics | null>(null)
  const [metricsConnected, setMetricsConnected] = useState(false)

  const [q, setQ] = useState('')
  const [tab, setTab] = useState<StatusTab>('all')
  const [page, setPage] = useState(1)

  const loadMetrics = useCallback(async (r: MetricsRange) => {
    try {
      const m = await AgentsApi.metrics(r)
      setMetrics(m)
      setMetricsConnected(true)
    } catch {
      setMetrics(null)
      setMetricsConnected(false)
    }
  }, [])

  useEffect(() => {
    void loadMetrics(range)
  }, [loadMetrics, range])

  const stats = useMemo(() => deriveAgentStats(agents), [agents])
  const health = useMemo(() => healthBreakdown(agents), [agents])
  const top = useMemo(() => topByInvocations(agents, 5), [agents])

  const invTotals = useMemo(() => summedSeries(metrics?.series ?? []), [metrics])
  const invDelta = trendPct(invTotals)
  const chartData: ChartPoint[] = useMemo(() => {
    const series = metrics?.series ?? []
    if (!series.length) return []
    const longest = series.reduce((a, b) => (b.points.length > a.points.length ? b : a), series[0])
    return invTotals.map((v, i) => ({ label: bucketLabel(longest.points[i]?.t ?? ''), value: v }))
  }, [metrics, invTotals])

  const filtered = useMemo(() => filterAgents(agents, { search: q, status: tab }), [agents, q, tab])
  const pageState = paginate(filtered, page, PAGE_SIZE)
  const agentColor = productColorHex('agents')

  const openDetail = useCallback(
    (a: Agent) =>
      detail.open({
        title: a.name,
        subtitle: `${a.model || 'agent'} · ${AGENT_STATUS_LABEL[a.status]}`,
        icon: Bot,
        iconColor: agentColor,
        content: <AgentDetailView agent={a} />,
        footer: live ? (
          <>
            <Button flex={1} chromeless onPress={detail.close}>
              Close
            </Button>
            <Button
              flex={1}
              theme="red"
              icon={<Trash2 size={15} />}
              onPress={() => {
                if (typeof window !== 'undefined' && !window.confirm(`Delete agent “${a.name}”? This cannot be undone.`)) return
                // Keyed by NAME — the backend's `DELETE /v1/agents/:name` handle. Passing
                // the display `id` (`agent_…`) 404s, which is what made this button a
                // silent no-op.
                void AgentsApi.remove(a.name)
                  .then(() => {
                    setAgents((rows) => rows.filter((r) => r.id !== a.id))
                    detail.close()
                  })
                  .catch((e) => {
                    // Never a silent failure: surface why the delete didn't take (the row stays).
                    if (typeof window !== 'undefined') {
                      window.alert(`Couldn’t delete “${a.name}”: ${e instanceof Error ? e.message : 'request failed'}`)
                    }
                  })
              }}
            >
              Delete
            </Button>
          </>
        ) : (
          <Button flex={1} chromeless onPress={detail.close}>
            Close
          </Button>
        ),
      }),
    [detail, agentColor, live, setAgents],
  )

  const analytics = useAnalytics()

  // ONE way to create an agent, and it is the quickstart. This used to open the
  // builder in a side pane — the same component, reached by a different shape, with
  // no templates, no drafting and nowhere to run what it made. Two entrances to one
  // builder is two things to keep in step; the pane was the lesser of them.
  const openNew = useCallback(() => router.push('/agents/quickstart'), [router])

  const header = (
    <PageHeader
      title="Agents"
      subtitle="Autonomous agents — a model, a prompt, and tools that run on Hanzo compute."
      actions={
        <XStack gap="$2" items="center" flexWrap="wrap">
          {agents.length > 0 ? (
            <XStack items="center" gap="$2" px="$3" borderWidth={1} borderColor="$borderColor" rounded="$3" minW={200}>
              <Search size={15} />
              <Input
                flex={1}
                unstyled
                value={q}
                onChangeText={(v: string) => {
                  setQ(v)
                  setPage(1)
                }}
                placeholder="Search agents…"
                autoCapitalize="none"
                py="$2"
              />
            </XStack>
          ) : null}
          <Button size="$3" chromeless icon={<RefreshCw size={15} />} onPress={() => void reload()} aria-label="Refresh" />
          <Button size="$3" theme="light" icon={<Plus size={15} />} onPress={openNew}>
            New Agent
          </Button>
        </XStack>
      }
    />
  )

  // Owned sub-pages: Status/Logs/Metrics render focused slices of the agents' OWN
  // runs (from /v1/agents), so they are never the empty generic o11y/ledger subpage.
  // Overview ('') shows everything. Metrics = counts + invocation trend + resource;
  // Status = health donut + agents table; Logs = the invocation activity feed.
  const routeTab = props.params?.tab ?? ''

  // ── Quickstart ──────────────────────────────────────────────────────────────
  // Its own surface, and it answers BEFORE the list's loading/error/empty states on
  // purpose: building an agent does not depend on reading the ones that exist, and
  // the moments you most need it — no agents yet, or the registry not answering —
  // are exactly the ones those early returns would have swallowed it in.
  if (routeTab === 'quickstart') {
    return (
      <>
        <PageHeader
          title="Build an agent"
          subtitle="Describe what you want, or start from a template. Four steps, and every one is a real call."
        />
        <AgentQuickstart
          loaders={agentBuilderLoaders}
          apiBase={config.apiUrl}
          onFinished={() => {
            analytics.capture(EVENTS.AGENT_CREATED)
            void reload()
          }}
        />
      </>
    )
  }

  // ── Initial loading ─────────────────────────────────────────────────────────
  if (loading && agents.length === 0 && !error) {
    return (
      <>
        {header}
        <XStack p="$6" justify="center">
          <Spinner size="large" color="$color11" />
        </XStack>
      </>
    )
  }

  // ── Hard backend failure (access / not-initialized / error) ───────────────────
  if (error && error.kind !== 'unavailable') {
    return (
      <>
        {header}
        <BackendStateCard state={error} onRetry={() => void reload()} hint="endpoint · GET /v1/agents" />
      </>
    )
  }

  // ── Honest empty (zero agents, or the /v1/agents route isn't bound yet) ───────
  if (agents.length === 0) {
    return (
      <>
        {header}
        {live ? (
          <XStack items="center" gap="$2" px="$3" py="$2" rounded="$4" bg="$color2" borderWidth={1} borderColor="$borderColor" self="center">
            <YStack width={8} height={8} rounded="$10" bg="$green10" />
            <Text fontSize="$2" color="$color11">Connected to Agents · no agents yet</Text>
          </XStack>
        ) : null}
        <EmptyState
          icon={Bot}
          title="Create your first agent"
          description="Agents are autonomous workers — a model, a system prompt, and a set of tools that run on Hanzo compute and call your APIs on their own."
          bullets={[
            'Define an agent with a model, prompt, and tools',
            'Give it tools — HTTP, MCP servers, or your own functions',
            'Deploy to Hanzo compute — invocations, health, and cost show up here',
          ]}
          primary={{ label: 'New Agent', onPress: openNew }}
          secondary={{ label: 'Agents docs', href: DOCS }}
        />
      </>
    )
  }

  const spark = invTotals.length >= 2 ? <Sparkline values={invTotals} /> : undefined
  const now = Date.now()

  const columns: Column<Agent>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (a) => (
        <XStack items="center" gap="$2.5" minW={0}>
          <AgentAvatar />
          <YStack minW={0} gap="$0.5">
            <XStack items="center" gap="$2" minW={0}>
              <Text fontSize="$3" fontWeight="700" color="$color12" numberOfLines={1}>
                {a.name}
              </Text>
              <VersionBadge version={a.version} />
            </XStack>
            <Text fontSize="$1" color="$color10" numberOfLines={1}>
              {a.model || DASH}
            </Text>
          </YStack>
        </XStack>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (a) => (
        <Text fontSize="$2" color="$color11" numberOfLines={2}>
          {a.description || DASH}
        </Text>
      ),
    },
    { key: 'status', header: 'Status', width: 104, render: (a) => <StatusPill status={a.status} /> },
    {
      key: 'last',
      header: 'Last invocation',
      width: 130,
      render: (a) => (
        <Text fontSize="$2" color="$color11" numberOfLines={1}>
          {fmtRelative(a.lastInvocationAt, now)}
        </Text>
      ),
    },
    {
      key: 'invocations',
      header: 'Invocations 30d',
      width: 122,
      render: (a) => (
        <Text fontSize="$3" color="$color12" fontWeight="600">
          {fmtCompact(a.invocations30d)}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 40,
      render: () => (
        <XStack justify="flex-end" opacity={0.6}>
          <MoreHorizontal size={16} />
        </XStack>
      ),
    },
  ]

  const tabs: StatusTab[] = ['all', ...AGENT_STATUSES]
  const tabCount = (t: StatusTab): number => (t === 'all' ? agents.length : health[t])

  const showMetrics = routeTab === '' || routeTab === 'metrics'
  const showStatus = routeTab === '' || routeTab === 'status'
  const showLogs = routeTab === '' || routeTab === 'logs'

  return (
    <>
      {header}

      {/* Row 1 — five headline stat cards (real / derived; spark+delta from series) */}
      {showMetrics && (
      <XStack flexWrap="wrap" gap="$3" items="stretch">
        <MetricCard icon={Bot} label="Total agents" value={fmtInt(stats.total)} sub="registered" />
        <MetricCard icon={Activity} label="Active" value={fmtInt(stats.active)} sub={`${stats.idle} idle · ${stats.error} error`} />
        <MetricCard icon={Gauge} label="Success rate 30d" value={fmtPct(stats.successRate)} sub="weighted" />
        <MetricCard
          icon={Zap}
          label="Invocations 30d"
          value={fmtCompact(stats.invocations30d)}
          sub="last 30 days"
          spark={spark}
          delta={<Delta pct={invDelta} />}
        />
        <MetricCard icon={Timer} label="Avg latency" value={fmtDuration(stats.avgLatencyMs)} sub="per invocation" />
      </XStack>
      )}

      {/* Row 2 — invocations over time + agent health donut */}
      {(showMetrics || showStatus) && (
      <XStack flexWrap="wrap" gap="$3" items="stretch">
        {showMetrics && (
        <Panel
          title="Invocations over time"
          flex={2}
          minW={360}
          action={
            <XStack gap="$1">
              {METRICS_RANGES.map((r) => (
                <Button
                  key={r}
                  size="$1"
                  bg={r === range ? '$color5' : 'transparent'}
                  borderWidth={1}
                  borderColor="$borderColor"
                  onPress={() => setRange(r)}
                >
                  {r}
                </Button>
              ))}
            </XStack>
          }
        >
          {chartData.length >= 2 ? (
            <LineChart data={chartData} formatValue={(v) => fmtCompact(v)} />
          ) : (
            <YStack height={210} items="center" justify="center" gap="$1">
              <Text fontSize="$3" color="$color11" fontWeight="600">
                No invocation time-series yet
              </Text>
              <Text fontSize="$2" color="$color10" text="center" maxW={420}>
                {metricsConnected
                  ? 'No agent invocations in this range yet — the headline counts above read from the live registry.'
                  : 'The Agents metrics route isn’t connected on this deployment, so no trend is drawn. Counts above are read from the live registry.'}
              </Text>
            </YStack>
          )}
        </Panel>
        )}

        {showStatus && (
        <Panel title="Agent health" minW={240}>
          <HealthDonut breakdown={health} />
        </Panel>
        )}
      </XStack>
      )}

      {/* Row 3 — agents table (status tabs + pagination) */}
      {showStatus && (
      <Panel title="Agents" minW={320}>
        <XStack gap="$1" flexWrap="wrap">
          {tabs.map((t) => (
            <Button
              key={t}
              size="$2"
              bg={t === tab ? '$color5' : 'transparent'}
              borderWidth={1}
              borderColor="$borderColor"
              onPress={() => {
                setTab(t)
                setPage(1)
              }}
            >
              {t === 'all' ? 'All' : AGENT_STATUS_LABEL[t]} · {tabCount(t)}
            </Button>
          ))}
        </XStack>

        <DataTable
          columns={columns}
          rows={pageState.rows}
          rowKey={(a) => a.id}
          onRowPress={openDetail}
          empty="No agents match these filters."
        />

        {pageState.totalPages > 1 ? (
          <XStack justify="space-between" items="center">
            <Text fontSize="$2" color="$color10">
              Page {pageState.page} of {pageState.totalPages} · {filtered.length} agents
            </Text>
            <XStack gap="$2">
              <Button size="$2" chromeless icon={<ChevronLeft size={15} />} disabled={pageState.page <= 1} onPress={() => setPage(pageState.page - 1)}>
                Prev
              </Button>
              <Button size="$2" chromeless iconAfter={<ChevronRight size={15} />} disabled={pageState.page >= pageState.totalPages} onPress={() => setPage(pageState.page + 1)}>
                Next
              </Button>
            </XStack>
          </XStack>
        ) : null}
      </Panel>
      )}

      {/* Row 4 — recent activity (logs) · top agents · resource usage (metrics) */}
      {(showLogs || showMetrics) && (
      <XStack flexWrap="wrap" gap="$3" items="stretch">
        {showLogs && (
        <Panel title="Recent activity" minW={280}>
          <ActivityFeed events={activity} now={now} />
        </Panel>
        )}
        {showMetrics && (
        <Panel title="Top agents by invocations" minW={280}>
          <TopAgents agents={top} />
        </Panel>
        )}
        {showMetrics && (
        <Panel title="Resource usage · 30d" minW={260}>
          <ResourceUsagePanel
            usage={metrics?.resource ?? { cpuVcpuHours: null, memGbHours: null, storageIoBytes: null, costCents: null }}
            connected={metricsConnected}
          />
        </Panel>
        )}
      </XStack>
      )}
    </>
  )
}
