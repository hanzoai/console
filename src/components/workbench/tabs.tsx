'use client'

/**
 * Workbench tab bodies — the compact developer surfaces the bottom Developers dock
 * renders. Each reuses the console's REAL data layer (the same clients the full
 * products use) rendered small for the drawer; nothing is fabricated — every tab
 * shows real org-scoped data or an honest empty/coming/runtime state.
 *
 *  - Overview  — integration snapshot: request volume + error rate + tokens/spend
 *    (charged ledger), the account's Cloud API key, the API version, and the
 *    developer-resource links (docs · API reference · SDKs · CLI).
 *  - Logs      — the recent charged API calls, filterable, row → JSON detail.
 *  - Events    — the platform-event stream projected from the same real ledger.
 *  - Webhooks  — a read-only live glance at the org's endpoints that deep-links into
 *    the full Webhooks product (which owns config/security/test/logs CRUD).
 *  - Health    — Alerts · Errors · Insights from the o11y runtime (honest
 *    RuntimeNotice when o11y isn't routed for the org).
 *  - Inspector — fetch any object by id (agent_… / fn_… / a resource path) → JSON.
 *  - Traces    — the existing TracesModule (LLM/agent traces), embedded.
 *  - Shell     — a read-only /v1 explorer with a resource picker + show-code.
 *
 * The shell (`Workbench.tsx`) owns the shared usage-ledger fetch and passes the
 * records into the ledger-backed tabs; the heavier tabs load their own data lazily
 * when selected (mounted only while active).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Card, Input, ScrollView, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  KeyRound,
  Lightbulb,
  Search,
  Webhook,
} from '@hanzogui/lucide-icons-2'

import {
  recent,
  totalsOf,
  withinRange,
  type UsageRecord,
} from '~/lib/api/aimetrics'
import { KeysApi, type KeyStatus } from '~/lib/api'
import { ApmApi, apmWindow, type ExceptionGroup, type ServiceHealth } from '~/lib/api/apm'
import { ApiError, cloudProxyV1Url, restGet } from '~/lib/api/client'
import { config } from '~/config'
import { MetricCard } from '~/components/ui/Metric'
import { RuntimeNotice } from '~/components/products/observability/RuntimeNotice'
import { TracesModule } from '~/components/products/TracesModule'
import { curlFor, eventsFrom, inspectorRoute, renderOutput, type PlatformEvent } from './logic'
import { Terminal } from './Terminal'
import { toneColor } from '~/components/ui/tone'

const usd = (cents: number, dp = 2): string => `$${(cents / 100).toFixed(dp)}`
const timeOf = (ms: number | null): string =>
  ms === null ? '—' : new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const openExternal = (url: string): void => {
  if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener')
}

/** One monospace cell in a compact grid. */
export function Cell({ w, flex, dim, right, children }: { w?: number; flex?: number; dim?: boolean; right?: boolean; children: string }) {
  return (
    <Text
      width={w}
      flex={flex}
      fontSize="$1"
      color={dim ? '$color10' : '$color12'}
      numberOfLines={1}
      className="hz-mono"
      style={right ? { textAlign: 'right' } : undefined}
    >
      {children}
    </Text>
  )
}

/** Copy-to-clipboard button with a transient confirmed state. */
function CopyBtn({ value, label = 'Copy', size = '$1' as const }: { value: string; label?: string; size?: '$1' | '$2' }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size={size}
      chromeless
      icon={copied ? <Check size={12} /> : <Copy size={12} />}
      onPress={() => {
        void navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1400)
          },
          () => undefined,
        )
      }}
      aria-label={label}
    >
      <Text fontSize="$1" color="$color10">
        {copied ? 'Copied' : label}
      </Text>
    </Button>
  )
}

/** A compact honest centered state (loading spinner / message). */
function Center({ children }: { children: ReactNode }) {
  return (
    <YStack flex={1} items="center" justify="center" p="$4" gap="$2">
      {children}
    </YStack>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────

/** A developer-resource link — a real docs/reference/SDK/CLI page (new tab). */
function ResLink({ label, url }: { label: string; url: string }) {
  return (
    <Button size="$1" chromeless iconAfter={<ExternalLink size={12} />} onPress={() => openExternal(url)}>
      <Text fontSize="$1" color="$color11">
        {label}
      </Text>
    </Button>
  )
}

export function OverviewTab({ records, onGo }: { records: UsageRecord[]; onGo: (path: string) => void }) {
  const day = withinRange(records, '24h', Date.now())
  const totals = totalsOf(day)
  const errors = day.filter((r) => r.status !== '' && r.status !== 'success').length
  const errRate = totals.requests ? (errors / totals.requests) * 100 : 0
  const [key, setKey] = useState<KeyStatus | null>(null)
  const [keyLoading, setKeyLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [keyErr, setKeyErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    KeysApi.status()
      .then((s) => alive && setKey(s))
      .catch(() => undefined)
      .finally(() => alive && setKeyLoading(false))
    return () => {
      alive = false
    }
  }, [])

  // Mint (or rotate) the account's real sk- Cloud API key. The secret is returned
  // ONCE by create() and shown once here (copy affordance); status() then reflects
  // the new key's public prefix. Honest error on failure — never a fake key.
  const createKey = async () => {
    setCreating(true)
    setKeyErr(null)
    try {
      const r = await KeysApi.create()
      setNewKey(r.accessKey)
      setKey(await KeysApi.status())
    } catch (e) {
      setKeyErr(e instanceof Error ? e.message : 'Could not create the key.')
    } finally {
      setCreating(false)
    }
  }

  const docs = `${config.docsUrl}/docs`

  return (
    <ScrollView flex={1} minH={0}>
      <YStack p="$3" gap="$3">
        <XStack gap="$3" flexWrap="wrap">
          <MetricCard icon={<Activity size={15} />} label="Requests" value={`${totals.requests}`} caption="Last 24h · charged ledger" />
          <MetricCard icon={<Activity size={15} />} label="Errors" value={`${errors}`} caption={`${errRate.toFixed(1)}% error rate, last 24h`} />
          <MetricCard icon={<Activity size={15} />} label="Tokens" value={`${totals.totalTokens}`} caption="Prompt + completion, last 24h" />
          <MetricCard icon={<Activity size={15} />} label="Spend" value={usd(totals.cents)} caption="Charged, last 24h" />
        </XStack>

        {/* API keys — the account's real sk- credential. Create/rotate the key INLINE
            (the secret shows ONCE, copy it), or Manage in the full API Keys product. */}
        <Card p="$3" gap="$2" borderWidth={1} borderColor="$borderColor" bg="$color2">
          <XStack items="center" gap="$2" flexWrap="wrap">
            <KeyRound size={14} color="$color10" />
            <Text fontSize="$2" fontWeight="600" color="$color12">
              API keys
            </Text>
            <XStack flex={1} minW={8} />
            <Button
              size="$1"
              bg="$color5"
              disabled={creating}
              onPress={() => void createKey()}
              aria-label={key?.hasKey ? 'Create a new API key' : 'Create an API key'}
            >
              <Text fontSize="$1" color="$color12" fontWeight="700">
                {creating ? 'Creating…' : key?.hasKey ? 'New key' : 'Create key'}
              </Text>
            </Button>
            <Button size="$1" chromeless iconAfter={<ChevronRight size={12} />} onPress={() => onGo('/api-keys')}>
              <Text fontSize="$1" color="$color11">
                Manage
              </Text>
            </Button>
          </XStack>
          <Text fontSize="$1" color="$color10" className="hz-mono">
            {keyLoading
              ? 'Loading…'
              : key?.hasKey
                ? `Cloud API key active · ${key.keyPrefix ? `${key.keyPrefix}…` : 'sk-…'}`
                : 'No Cloud API key yet — create one to call the gateway as Bearer sk-…'}
          </Text>
          {newKey ? (
            <YStack gap="$1" p="$2" rounded="$3" borderWidth={1} borderColor="$color7" bg="$color1">
              <Text fontSize="$1" color="$color11" fontWeight="700">
                Your new key — copy it now, it is shown only once:
              </Text>
              <XStack gap="$2" items="center">
                <Text flex={1} fontSize="$1" color="$color12" className="hz-mono" numberOfLines={1}>
                  {newKey}
                </Text>
                <Button
                  size="$1"
                  onPress={() => {
                    try {
                      void navigator.clipboard?.writeText(newKey)
                    } catch {
                      /* clipboard unavailable — the key text is selectable */
                    }
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                >
                  <Text fontSize="$1" fontWeight="700">
                    {copied ? 'Copied' : 'Copy'}
                  </Text>
                </Button>
              </XStack>
            </YStack>
          ) : null}
          {keyErr ? (
            <Text fontSize="$1" color={toneColor('critical')}>
              {keyErr}
            </Text>
          ) : null}
          <Text fontSize="$1" color="$color9">
            sk- (secret) — presented as Authorization: Bearer to api.hanzo.ai. pk- (publishable) is safe in client code and never authenticates.
          </Text>
        </Card>

        {/* API version + developer resources. */}
        <Card p="$3" gap="$2" borderWidth={1} borderColor="$borderColor" bg="$color2">
          <XStack items="center" gap="$2">
            <Text fontSize="$2" fontWeight="600" color="$color12">
              API v1
            </Text>
            <Text fontSize="$1" color="$color10" className="hz-mono">
              {config.brandName} · {config.cloudUrl.replace(/^https?:\/\//, '')}/v1
            </Text>
          </XStack>
          <XStack gap="$1" flexWrap="wrap">
            <ResLink label="Docs" url={docs} />
            <ResLink label="API reference" url={`${docs}/api`} />
            <ResLink label="SDKs" url={`${docs}/sdks`} />
            <ResLink label="CLI" url={`${docs}/cli`} />
          </XStack>
        </Card>

        <XStack gap="$2" flexWrap="wrap">
          <Button size="$2" onPress={() => onGo('/ai-metrics')}>
            AI Metrics
          </Button>
          <Button size="$2" onPress={() => onGo('/api-keys')}>
            API keys
          </Button>
          <Button size="$2" onPress={() => onGo('/o11y')}>
            Traces
          </Button>
        </XStack>
      </YStack>
    </ScrollView>
  )
}

// ── Logs ───────────────────────────────────────────────────────────────────────

export function LogsTab({ records }: { records: UsageRecord[] }) {
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<UsageRecord | null>(null)
  const all = recent(records, 200)
  const q = filter.trim().toLowerCase()
  const rows = q
    ? all.filter((r) => `${r.model} ${r.status} ${r.provider} ${r.notes}`.toLowerCase().includes(q))
    : all.slice(0, 50)

  if (all.length === 0) {
    return (
      <Center>
        <Text fontSize="$2" color="$color10">
          No charged API activity yet — calls appear here as they are metered.
        </Text>
      </Center>
    )
  }

  if (open) {
    return (
      <YStack flex={1} minH={0}>
        <XStack items="center" gap="$2" px="$3" height={36} borderBottomWidth={1} borderColor="$borderColor">
          <Button size="$1" chromeless onPress={() => setOpen(null)} aria-label="Back to logs">
            <Text fontSize="$1" color="$color10">
              ← Logs
            </Text>
          </Button>
          <Text fontSize="$1" color="$color11" className="hz-mono" numberOfLines={1}>
            {open.model || open.notes || open.id}
          </Text>
        </XStack>
        <ScrollView flex={1} minH={0}>
          <Text p="$3" fontSize="$1" color="$color12" className="hz-mono" style={{ whiteSpace: 'pre-wrap' }}>
            {renderOutput({
              id: open.id,
              time: open.at ? new Date(open.at).toISOString() : null,
              model: open.model,
              provider: open.provider,
              product: open.product,
              status: open.status,
              tokens: { prompt: open.promptTokens, completion: open.completionTokens, total: open.totalTokens },
              cost: usd(open.cents, 4),
              requestId: open.requestId,
              notes: open.notes,
            })}
          </Text>
        </ScrollView>
      </YStack>
    )
  }

  return (
    <YStack flex={1} minH={0}>
      <XStack items="center" gap="$2" px="$3" height={36} borderBottomWidth={1} borderColor="$borderColor">
        <Search size={12} color="$color10" />
        <Input
          flex={1}
          unstyled
          value={filter}
          onChangeText={setFilter}
          placeholder="Filter by model, status, provider…"
          fontSize="$1"
          color="$color12"
          className="hz-mono"
          autoCapitalize="none"
          autoCorrect={false}
          aria-label="Filter API logs"
        />
      </XStack>
      <ScrollView flex={1} minH={0}>
        <YStack px="$3" py="$2" gap="$1">
          <XStack gap="$3" pb="$1" borderBottomWidth={1} borderColor="$borderColor">
            <Cell w={90} dim>Time</Cell>
            <Cell flex={1} dim>Model</Cell>
            <Cell w={80} dim>Status</Cell>
            <Cell w={80} dim right>Tokens</Cell>
            <Cell w={80} dim right>Cost</Cell>
          </XStack>
          {rows.map((r) => (
            <XStack
              key={r.id}
              gap="$3"
              py={3}
              cursor="pointer"
              hoverStyle={{ bg: '$color3' }}
              onPress={() => setOpen(r)}
            >
              <Cell w={90} dim>{timeOf(r.at)}</Cell>
              <Cell flex={1}>{r.model || r.notes || '—'}</Cell>
              <Cell w={80} dim>{r.status || '—'}</Cell>
              <Cell w={80} right>{`${r.totalTokens}`}</Cell>
              <Cell w={80} right>{usd(r.cents, 4)}</Cell>
            </XStack>
          ))}
          {rows.length === 0 ? (
            <Text py="$3" fontSize="$1" color="$color10">
              No calls match “{filter}”.
            </Text>
          ) : null}
        </YStack>
      </ScrollView>
    </YStack>
  )
}

// ── Events ──────────────────────────────────────────────────────────────────────

export function EventsTab({ records }: { records: UsageRecord[] }) {
  const events: PlatformEvent[] = eventsFrom(records).slice(0, 100)
  return (
    <YStack flex={1} minH={0}>
      <XStack items="center" px="$3" height={30} borderBottomWidth={1} borderColor="$borderColor">
        <Text fontSize="$1" color="$color9">
          Platform events — usage &amp; billing activity your account emits. Webhook deliveries appear here once a destination is added.
        </Text>
      </XStack>
      {events.length === 0 ? (
        <Center>
          <Text fontSize="$2" color="$color10">
            No platform events yet — they stream here as your account calls the API.
          </Text>
        </Center>
      ) : (
        <ScrollView flex={1} minH={0}>
          <YStack px="$3" py="$2" gap="$1">
            <XStack gap="$3" pb="$1" borderBottomWidth={1} borderColor="$borderColor">
              <Cell w={90} dim>Time</Cell>
              <Cell w={170} dim>Type</Cell>
              <Cell flex={1} dim>Object</Cell>
              <Cell w={70} dim right>Cost</Cell>
            </XStack>
            {events.map((e, i) => (
              <XStack key={`${e.id}-${i}`} gap="$3" py={3}>
                <Cell w={90} dim>{timeOf(e.at)}</Cell>
                <Text
                  width={170}
                  fontSize="$1"
                  numberOfLines={1}
                  className="hz-mono"
                  color={e.status !== '' && e.status !== 'success' ? toneColor('critical') : '$color11'}
                >
                  {e.type}
                </Text>
                <Cell flex={1}>{e.object}</Cell>
                <Cell w={70} right>{usd(e.cents, 4)}</Cell>
              </XStack>
            ))}
          </YStack>
        </ScrollView>
      )}
    </YStack>
  )
}

// ── Webhooks / Destinations ─────────────────────────────────────────────────────

type Destination = { id: string; url: string; events: string; status: string }

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

/** Normalize a webhook-destination row from whatever the endpoint returns. */
function normalizeDestination(r: unknown, i: number): Destination {
  const o = (r ?? {}) as Record<string, unknown>
  const events = Array.isArray(o.events) ? (o.events as unknown[]).map(str).join(', ') : str(o.events) || str(o.eventTypes)
  return {
    id: str(o.id) || str(o.url) || `dest-${i}`,
    url: str(o.url) || str(o.endpoint) || str(o.target),
    events: events || '*',
    status: str(o.status) || (o.enabled === false ? 'disabled' : 'enabled'),
  }
}

/**
 * The dock's Webhooks tab is a READ-ONLY compact glance that deep-links into the
 * full Webhooks product (`/webhooks`). The real config/enable/security/test/logs
 * CRUD now lives in `WebhooksModule`, so — per "one way to do everything" — the dock
 * does NOT duplicate it: it shows a live snapshot of the org's endpoints and every
 * affordance ("Manage in Webhooks", a row tap) navigates to the product. A 404 (API
 * not routed yet) stays the honest "coming" state, never an error card.
 */
export function WebhooksTab({ onGo }: { onGo: (path: string) => void }) {
  const [rows, setRows] = useState<Destination[] | null>(null)
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    restGet<unknown>(cloudProxyV1Url('webhooks'))
      .then((body) => {
        if (!alive) return
        const list = Array.isArray(body)
          ? body
          : Array.isArray((body as { data?: unknown[] })?.data)
            ? (body as { data: unknown[] }).data
            : []
        setRows(list.map(normalizeDestination))
        setAvailable(true)
      })
      .catch(() => {
        if (!alive) return
        setAvailable(false)
        setRows([])
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  if (loading) {
    return (
      <Center>
        <Spinner size="small" color="$color11" />
      </Center>
    )
  }

  if (!available || (rows ?? []).length === 0) {
    return (
      <Center>
        <Webhook size={22} color="$color9" />
        <Text fontSize="$3" fontWeight="600" color="$color12">
          {available ? 'No webhook endpoints yet' : 'Webhooks are coming'}
        </Text>
        <Text fontSize="$2" color="$color10" style={{ textAlign: 'center', maxWidth: 460 }}>
          {available
            ? 'Deliver platform events (usage, billing, agent, and webhook events) to your own HTTPS endpoints — signed, retried, and logged.'
            : 'Outbound webhook delivery is not wired on this deployment yet. When it lands, register and manage endpoints in the Webhooks product; until then, subscribe to your event stream in the Events tab.'}
        </Text>
        <Button
          size="$2"
          bg="$color5"
          iconAfter={<ChevronRight size={14} />}
          disabled={!available}
          onPress={() => onGo('/webhooks')}
        >
          {available ? 'Open Webhooks' : 'Learn more'}
        </Button>
      </Center>
    )
  }

  return (
    <ScrollView flex={1} minH={0}>
      <YStack px="$3" py="$2" gap="$1">
        <XStack items="center" gap="$2" pb="$1">
          <Text fontSize="$2" fontWeight="600" color="$color12" flex={1}>
            Webhook endpoints
          </Text>
          <Button size="$1" chromeless iconAfter={<ChevronRight size={12} />} onPress={() => onGo('/webhooks')}>
            <Text fontSize="$1" color="$color11">
              Manage in Webhooks
            </Text>
          </Button>
        </XStack>
        <XStack gap="$3" pb="$1" borderBottomWidth={1} borderColor="$borderColor">
          <Cell flex={1} dim>Endpoint</Cell>
          <Cell w={140} dim>Events</Cell>
          <Cell w={80} dim>Status</Cell>
        </XStack>
        {(rows ?? []).map((d) => (
          <XStack
            key={d.id}
            gap="$3"
            py={3}
            cursor="pointer"
            hoverStyle={{ bg: '$color3' }}
            onPress={() => onGo(`/webhooks/${encodeURIComponent(d.id)}`)}
          >
            <Cell flex={1}>{d.url || '—'}</Cell>
            <Cell w={140} dim>{d.events}</Cell>
            <Cell w={80} dim>{d.status}</Cell>
          </XStack>
        ))}
      </YStack>
    </ScrollView>
  )
}

// ── Health (Alerts · Errors · Insights) ─────────────────────────────────────────

type HealthSub = 'alerts' | 'errors' | 'insights'

type AlertRow = { id: string; name: string; state: string; severity: string }

function AlertsView() {
  const [rows, setRows] = useState<AlertRow[] | null>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let alive = true
    restGet<{ data?: { rules?: unknown[] } }>(cloudProxyV1Url('o11y/rules'))
      .then((body) => {
        if (!alive) return
        const rules = Array.isArray(body?.data?.rules) ? (body.data!.rules as Record<string, unknown>[]) : []
        setRows(
          rules.map((r, i) => ({
            id: str(r.id) || `rule-${i}`,
            name: str(r.alert) || str(r.description) || str(r.id),
            state: r.disabled ? 'disabled' : str(r.state) || 'inactive',
            severity: str((r.labels as Record<string, string> | undefined)?.severity),
          })),
        )
        setError(null)
      })
      .catch((e) => alive && setError(e))
    return () => {
      alive = false
    }
  }, [])

  if (error) return <RuntimeNotice surface="alerts" error={error} />
  if (rows === null) return <Center><Spinner size="small" color="$color11" /></Center>
  if (rows.length === 0)
    return (
      <Center>
        <Text fontSize="$2" color="$color10">
          No alert rules configured. Rules you create appear here with their live state.
        </Text>
      </Center>
    )
  return (
    <ScrollView flex={1} minH={0}>
      <YStack px="$3" py="$2" gap="$1">
        {rows.map((a) => (
          <XStack key={a.id} gap="$3" py={3} items="center">
            <Cell flex={1}>{a.name}</Cell>
            <Cell w={90} dim>{a.severity || '—'}</Cell>
            <Text width={90} fontSize="$1" className="hz-mono" color={a.state === 'firing' ? toneColor('critical') : '$color10'}>
              {a.state}
            </Text>
          </XStack>
        ))}
      </YStack>
    </ScrollView>
  )
}

function ErrorsView() {
  const [rows, setRows] = useState<ExceptionGroup[] | null>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let alive = true
    ApmApi.exceptions(apmWindow(24 * 3600), { limit: 50 })
      .then((r) => alive && (setRows(r), setError(null)))
      .catch((e) => alive && setError(e))
    return () => {
      alive = false
    }
  }, [])

  if (error) return <RuntimeNotice surface="errors" error={error} />
  if (rows === null) return <Center><Spinner size="small" color="$color11" /></Center>
  if (rows.length === 0)
    return (
      <Center>
        <Text fontSize="$2" color="$color10">
          No errors in the last 24h. Recent exception groups (with counts) appear here.
        </Text>
      </Center>
    )
  return (
    <ScrollView flex={1} minH={0}>
      <YStack px="$3" py="$2" gap="$1">
        <XStack gap="$3" pb="$1" borderBottomWidth={1} borderColor="$borderColor">
          <Cell flex={1} dim>Exception</Cell>
          <Cell w={120} dim>Service</Cell>
          <Cell w={60} dim right>Count</Cell>
        </XStack>
        {rows.map((e) => (
          <XStack key={e.groupID || `${e.exceptionType}-${e.exceptionMessage}`} gap="$3" py={3}>
            <Cell flex={1}>{e.exceptionType ? `${e.exceptionType}: ${e.exceptionMessage}` : e.exceptionMessage || '—'}</Cell>
            <Cell w={120} dim>{e.serviceName || '—'}</Cell>
            <Cell w={60} right>{`${e.exceptionCount}`}</Cell>
          </XStack>
        ))}
      </YStack>
    </ScrollView>
  )
}

function InsightsView() {
  const [health, setHealth] = useState<ServiceHealth[] | null>(null)
  const [exceptions, setExceptions] = useState<ExceptionGroup[]>([])
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let alive = true
    const w = apmWindow(3600)
    Promise.all([ApmApi.services(w), ApmApi.exceptions(apmWindow(24 * 3600), { limit: 20 }).catch(() => [])])
      .then(([services, exc]) => {
        if (!alive) return
        setHealth(
          services
            .filter((s) => s.serviceName && s.numCalls > 0)
            .map((s) => ({
              service: s.serviceName,
              numCalls: s.numCalls,
              callRate: s.callRate,
              errorRatePct: Math.max(0, s.errorRate),
              p99Ms: s.p99 / 1_000_000,
              avgMs: s.avgDuration / 1_000_000,
              tone: (s.errorRate >= 5 ? 'red' : s.errorRate >= 1 ? 'yellow' : 'green') as ServiceHealth['tone'],
            })),
        )
        setExceptions(exc)
        setError(null)
      })
      .catch((e) => alive && setError(e))
    return () => {
      alive = false
    }
  }, [])

  if (error) return <RuntimeNotice surface="insights" error={error} />
  if (health === null) return <Center><Spinner size="small" color="$color11" /></Center>

  const degraded = health.filter((h) => h.tone !== 'green').sort((a, b) => b.errorRatePct - a.errorRatePct)
  const topError = exceptions[0]

  if (health.length === 0 && !topError)
    return (
      <Center>
        <Lightbulb size={20} color="$color9" />
        <Text fontSize="$2" color="$color10" style={{ textAlign: 'center', maxWidth: 440 }}>
          No telemetry in the window yet — recommendations (error patterns, degraded services, recent 5xx) appear here once your services emit spans.
        </Text>
      </Center>
    )

  return (
    <ScrollView flex={1} minH={0}>
      <YStack p="$3" gap="$2">
        {degraded.length === 0 ? (
          <Card p="$3" borderWidth={1} borderColor="$borderColor" bg="$color2">
            <Text fontSize="$2" color="$color11">
              All {health.length} reporting service{health.length === 1 ? '' : 's'} are healthy (&lt;1% errors) over the last hour.
            </Text>
          </Card>
        ) : (
          degraded.map((h) => (
            <Card key={h.service} p="$3" gap="$1" borderWidth={1} borderColor="$borderColor" bg="$color2">
              <XStack items="center" gap="$2">
                <AlertTriangle size={13} color={toneColor(h.tone === 'red' ? 'critical' : 'warning')} />
                <Text fontSize="$2" fontWeight="600" color="$color12">
                  {h.service}
                </Text>
              </XStack>
              <Text fontSize="$1" color="$color10" className="hz-mono">
                {h.errorRatePct.toFixed(1)}% errors · p99 {h.p99Ms.toFixed(0)}ms · {h.callRate.toFixed(1)} req/s — investigate the error spike.
              </Text>
            </Card>
          ))
        )}
        {topError ? (
          <Card p="$3" gap="$1" borderWidth={1} borderColor="$borderColor" bg="$color2">
            <Text fontSize="$2" fontWeight="600" color="$color12">
              Top exception (24h)
            </Text>
            <Text fontSize="$1" color="$color10" className="hz-mono">
              {topError.exceptionType}: {topError.exceptionMessage} · ×{topError.exceptionCount}
              {topError.serviceName ? ` · ${topError.serviceName}` : ''}
            </Text>
          </Card>
        ) : null}
      </YStack>
    </ScrollView>
  )
}

const HEALTH_SUBS: { id: HealthSub; label: string }[] = [
  { id: 'alerts', label: 'Alerts' },
  { id: 'errors', label: 'Errors' },
  { id: 'insights', label: 'Insights' },
]

export function HealthTab() {
  const [sub, setSub] = useState<HealthSub>('alerts')
  return (
    <YStack flex={1} minH={0}>
      <XStack items="center" gap="$1" px="$2" height={34} borderBottomWidth={1} borderColor="$borderColor">
        {HEALTH_SUBS.map((s) => (
          <Button
            key={s.id}
            size="$1"
            chromeless
            bg={sub === s.id ? '$color4' : 'transparent'}
            onPress={() => setSub(s.id)}
            aria-label={s.label}
          >
            <Text fontSize="$1" color={sub === s.id ? '$color12' : '$color10'} fontWeight="600">
              {s.label}
            </Text>
          </Button>
        ))}
      </XStack>
      {sub === 'alerts' ? <AlertsView /> : sub === 'errors' ? <ErrorsView /> : <InsightsView />}
    </YStack>
  )
}

// ── Inspector ────────────────────────────────────────────────────────────────────

export function InspectorTab({ records }: { records: UsageRecord[] }) {
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ label: string; path: string; output: string; ok: boolean } | null>(null)
  const [related, setRelated] = useState<UsageRecord[]>([])

  const run = useCallback(async () => {
    const id = input.trim()
    if (!id || running) return
    const target = inspectorRoute(id)
    if ('error' in target) {
      setResult({ label: 'Inspector', path: '', output: target.error, ok: false })
      setRelated([])
      return
    }
    setRunning(true)
    setResult(null)
    // Related activity from the real usage ledger (id matches a request/model/agent).
    const idl = id.toLowerCase()
    setRelated(
      records
        .filter((r) => [r.requestId, r.model, r.agent, r.id].some((v) => v && v.toLowerCase() === idl))
        .slice(0, 8),
    )
    try {
      const data = await restGet<unknown>(cloudProxyV1Url(target.path))
      setResult({ label: target.label, path: target.path, output: renderOutput(data), ok: true })
    } catch (err) {
      const output =
        err instanceof ApiError ? `HTTP ${err.status} — ${err.message}` : err instanceof Error ? err.message : String(err)
      setResult({ label: target.label, path: target.path, output, ok: false })
    } finally {
      setRunning(false)
    }
  }, [input, running, records])

  return (
    <YStack flex={1} minH={0}>
      <XStack items="center" gap="$2" px="$3" height={40} borderBottomWidth={1} borderColor="$borderColor">
        <Search size={13} color="$color10" />
        <Input
          flex={1}
          unstyled
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => void run()}
          placeholder={running ? 'Inspecting…' : 'Inspect any object — agent_… , fn_… , run_… , or agents/<name>'}
          fontSize="$2"
          color="$color12"
          className="hz-mono"
          autoCapitalize="none"
          autoCorrect={false}
          aria-label="Inspector object id"
        />
        <Button size="$2" onPress={() => void run()} disabled={running}>
          Inspect
        </Button>
      </XStack>
      <ScrollView flex={1} minH={0}>
        <YStack p="$3" gap="$2">
          {result === null ? (
            <Text fontSize="$1" color="$color10" className="hz-mono">
              Fetch a Hanzo object by id and see its JSON. Routes by prefix to the right /v1 GET — runs as you, in your org.
            </Text>
          ) : (
            <>
              {result.path ? (
                <XStack items="center" gap="$2">
                  <Text fontSize="$1" color="$color11" className="hz-mono">
                    {result.label} · GET /v1/{result.path}
                  </Text>
                  <XStack flex={1} />
                  {result.ok ? <CopyBtn value={curlFor(result.path)} label="curl" /> : null}
                </XStack>
              ) : null}
              <Text fontSize="$1" color={result.ok ? '$color12' : toneColor('critical')} className="hz-mono" style={{ whiteSpace: 'pre-wrap' }}>
                {result.output}
              </Text>
              {related.length > 0 ? (
                <YStack gap="$1" pt="$2" borderTopWidth={1} borderColor="$borderColor">
                  <Text fontSize="$1" color="$color10">
                    Related activity ({related.length})
                  </Text>
                  {related.map((r) => (
                    <XStack key={r.id} gap="$3" py={2}>
                      <Cell w={90} dim>{timeOf(r.at)}</Cell>
                      <Cell flex={1}>{r.model || r.notes || '—'}</Cell>
                      <Cell w={70} dim>{r.status || '—'}</Cell>
                      <Cell w={70} right>{usd(r.cents, 4)}</Cell>
                    </XStack>
                  ))}
                </YStack>
              ) : null}
            </>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  )
}

// ── Traces (the existing TracesModule, embedded) ─────────────────────────────────

export function TracesTab() {
  return (
    <ScrollView flex={1} minH={0}>
      <YStack p="$3" gap="$3">
        <TracesModule params={{}} />
      </YStack>
    </ScrollView>
  )
}

// ── Shell — the cloud shell ──────────────────────────────────────────────────

/**
 * The Shell tab IS a terminal. The component that carries it lives on its own
 * (Terminal.tsx) because it loads xterm in the browser and owns a socket, and
 * neither belongs in a file of render-only tabs.
 */
export function ShellTab() {
  return <Terminal />
}
