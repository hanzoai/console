'use client'

/**
 * Logs — two real lenses, one product, honest states throughout.
 *
 *  1. APPLICATION logs (default) — full-text application/platform logs from the
 *     Hanzo o11y (O11y) runtime, read through the same-origin `/v1` bearer
 *     proxy as `POST /v1/o11y/query_range` (the version-less canonical o11y
 *     surface; a v5 `requestType: raw` builder query over `signal: logs`
 *     — `ApmApi.logs`). Real
 *     log lines (time · severity · service · message), org-scoped by the minted
 *     bearer, filterable by severity + service. Honest states: loading, the
 *     shared o11y `RuntimeNotice` on 503/404/401/403, and an honest "connected ·
 *     no application logs in this window" empty state (never a fabricated grid).
 *     This replaces the old "no clean logs-list route" placeholder: the real read
 *     IS the composite `query_range`, which this lens now issues.
 *
 *  2. REQUEST activity — the org's billed API/model calls from the commerce usage
 *     ledger (`GET /v1/billing/usage` via `/billing`), one row per request. The
 *     ONE per-request source that is always real for the org, filterable by
 *     endpoint + level. Unchanged from before; kept as the guaranteed-real lens.
 *
 * The two are ORTHOGONAL sources (o11y OTLP logs vs the billing ledger) surfaced
 * as two lenses of the one Logs product — nothing is fabricated in either.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Input, Text, XStack, YStack } from '@hanzo/gui'
import { BarChart3, Bookmark, Download, RefreshCw, ScrollText, Search, Server, X } from '@hanzogui/lucide-icons-2'

import { asApiError, ErrorState } from '~/components/ui/States'
import { fetchUsageRecords, type UsageRecord } from '~/lib/api/aimetrics'
import { logsFromRecords, type LogLine } from '~/components/products/inference/logic'
import { ApmApi, apmWindow, type LogRow } from '~/lib/api/apm'
import type { ApiError } from '~/lib/api'
import { exportCSV } from '~/lib/csv'
import { RuntimeNotice } from './observability/RuntimeNotice'
import { DataTable, PageHeader, SelectMenu, StatusTag, type Column, type SelectOption } from '@hanzo/ui/product'

const LOG_LIMIT = 250

// ── shared bits ──────────────────────────────────────────────────────────────

/** Honest local time label; em-dash when the row carries no parseable time. */
function fmtTime(at: number | null): string {
  if (at === null) return '—'
  const d = new Date(at)
  return Number.isNaN(d.getTime())
    ? '—'
    : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
}

/** Distinct, sorted values for a filter dropdown (blank values dropped). */
function distinctOf<T>(rows: T[], pick: (r: T) => string): SelectOption<string>[] {
  const seen = new Set<string>()
  for (const r of rows) {
    const v = pick(r)
    if (v) seen.add(v)
  }
  return [...seen].sort().map((v) => ({ key: v, label: v }))
}

/** Case-insensitive substring match, used by the contains-text log filter. */
const contains = (haystack: string, needle: string): boolean =>
  needle.trim() === '' || haystack.toLowerCase().includes(needle.trim().toLowerCase())

// ── saved views (localStorage) ────────────────────────────────────────────────
// A saved view is a named filter preset for the application-logs lens. It is a
// convenience only — persistence failures are swallowed, never surfaced.
type SavedView = { id: string; name: string; range: string; severity: string | null; service: string | null; text: string }
const VIEWS_KEY = 'console.logs.savedViews'

function loadViews(): SavedView[] {
  if (typeof window === 'undefined') return []
  try {
    const arr = JSON.parse(window.localStorage.getItem(VIEWS_KEY) ?? '[]') as unknown
    return Array.isArray(arr) ? (arr.filter((v) => v && typeof v === 'object') as SavedView[]) : []
  } catch {
    return []
  }
}
function persistViews(views: SavedView[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(VIEWS_KEY, JSON.stringify(views))
  } catch {
    /* storage full / disabled — a saved view is a convenience, never load-bearing */
  }
}

/** A compact contains-text search box shared by the log lenses. */
function LogSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <XStack items="center" gap="$2" px="$2.5" height={34} rounded="$3" borderWidth={1} borderColor="$borderColor" bg="$color2" minW={200}>
      <Search size={14} opacity={0.6} />
      <Input flex={1} unstyled value={value} onChangeText={onChange} placeholder="Contains text…" fontSize="$3" color="$color12" autoCapitalize="none" />
      {value ? <Button size="$1" chromeless icon={<X size={13} />} onPress={() => onChange('')} aria-label="Clear text filter" /> : null}
    </XStack>
  )
}

type Lens = 'application' | 'requests'

/** Small segmented control shared by the lens + range toggles. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { key: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <XStack gap="$1" flexWrap="wrap">
      {options.map((o) => (
        <Button
          key={o.key}
          size="$2"
          bg={o.key === value ? '$color5' : 'transparent'}
          borderWidth={1}
          borderColor="$borderColor"
          onPress={() => onChange(o.key)}
        >
          {o.label}
        </Button>
      ))}
    </XStack>
  )
}

// ── Application logs lens (o11y / O11y) ─────────────────────────────────────

const RANGES: { key: string; label: string; seconds: number }[] = [
  { key: '15m', label: '15m', seconds: 900 },
  { key: '1h', label: '1h', seconds: 3600 },
  { key: '6h', label: '6h', seconds: 21_600 },
  { key: '24h', label: '24h', seconds: 86_400 },
]

type AppState =
  | { phase: 'loading' }
  | { phase: 'error'; err: ApiError }
  | { phase: 'ready'; lines: LogRow[] }

function ApplicationLogsLens() {
  const [state, setState] = useState<AppState>({ phase: 'loading' })
  const [rangeIdx, setRangeIdx] = useState(1) // default 1h
  const [severity, setSeverity] = useState<string | null>(null)
  const [service, setService] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [views, setViews] = useState<SavedView[]>([])

  useEffect(() => {
    setViews(loadViews())
  }, [])

  const load = useCallback(async (idx: number) => {
    setState({ phase: 'loading' })
    try {
      const lines = await ApmApi.logs(apmWindow(RANGES[idx].seconds), 500)
      setState({ phase: 'ready', lines })
    } catch (e) {
      setState({ phase: 'error', err: asApiError(e) })
    }
  }, [])

  useEffect(() => {
    void load(rangeIdx)
  }, [load, rangeIdx])

  const all = state.phase === 'ready' ? state.lines : []
  const severityOptions = useMemo(() => distinctOf(all, (l) => l.severity), [all])
  const serviceOptions = useMemo(() => distinctOf(all, (l) => l.service), [all])
  // The query builder: time range is composed into the o11y query server-side; the
  // severity/service/contains-text axes narrow the returned window client-side.
  const lines = useMemo(
    () => all.filter((l) => (!severity || l.severity === severity) && (!service || l.service === service) && contains(l.body ?? '', text)),
    [all, severity, service, text],
  )

  const rangeKey = RANGES[rangeIdx].key
  const hasFilters = Boolean(severity || service || text)

  const saveView = useCallback(() => {
    const name = [severity, service, text ? `"${text.trim()}"` : '', rangeKey].filter(Boolean).join(' · ') || 'All logs'
    const view: SavedView = { id: `${Date.now()}`, name, range: rangeKey, severity, service, text }
    setViews((prev) => {
      const next = [view, ...prev.filter((v) => v.name !== name)].slice(0, 12)
      persistViews(next)
      return next
    })
  }, [severity, service, text, rangeKey])

  const applyView = useCallback((v: SavedView) => {
    const idx = RANGES.findIndex((r) => r.key === v.range)
    if (idx >= 0) setRangeIdx(idx)
    setSeverity(v.severity)
    setService(v.service)
    setText(v.text)
  }, [])

  const removeView = useCallback((id: string) => {
    setViews((prev) => {
      const next = prev.filter((v) => v.id !== id)
      persistViews(next)
      return next
    })
  }, [])

  const onExport = useCallback(() => {
    if (!lines.length) return
    exportCSV(
      `logs-${rangeKey}`,
      ['Time', 'Severity', 'Service', 'Message'],
      lines.map((l) => [l.timestamp ? new Date(l.timestamp).toISOString() : '', l.severity, l.service, l.body]),
    )
  }, [lines, rangeKey])

  const columns: Column<LogRow>[] = [
    { key: 'time', header: 'Time', width: 200, render: (l) => <Text fontSize="$2" color="$color11" numberOfLines={1}>{l.timestamp ? new Date(l.timestamp).toLocaleString() : '—'}</Text> },
    { key: 'severity', header: 'Severity', width: 110, render: (l) => (l.severity ? <StatusTag status={l.severity} /> : <Text fontSize="$2" color="$color10">—</Text>) },
    { key: 'service', header: 'Service', width: 170, render: (l) => <Text fontSize="$2" color="$color11" numberOfLines={1}>{l.service || '—'}</Text> },
    { key: 'body', header: 'Message', render: (l) => <Text fontSize="$2" color="$color11" numberOfLines={1}>{l.body || '—'}</Text> },
  ]

  if (state.phase === 'error') {
    return <RuntimeNotice surface="logs" error={state.err} />
  }

  const rangeLabel = RANGES[rangeIdx].label
  return (
    <YStack gap="$3">
      {/* ── Query builder ────────────────────────────────────────────────── */}
      <XStack gap="$3" items="center" flexWrap="wrap" justify="space-between">
        <XStack gap="$2" items="center" flexWrap="wrap">
          <ScrollText size={16} />
          <Text fontSize="$2" color="$color10">Range</Text>
          <Segmented value={rangeKey} options={RANGES} onChange={(k) => setRangeIdx(RANGES.findIndex((r) => r.key === k))} />
        </XStack>
        <XStack gap="$2" items="center" flexWrap="wrap">
          <SelectMenu options={severityOptions} value={severity} onChange={setSeverity} allLabel="All severities" />
          <SelectMenu options={serviceOptions} value={service} onChange={setService} allLabel="All services" />
          <LogSearch value={text} onChange={setText} />
          <Button size="$2" chromeless icon={<Bookmark size={14} />} onPress={saveView} disabled={!hasFilters} aria-label="Save this view">
            Save view
          </Button>
          <Button size="$2" chromeless icon={<Download size={14} />} onPress={onExport} disabled={!lines.length} aria-label="Export logs CSV">
            Export
          </Button>
        </XStack>
      </XStack>

      {/* ── Saved views ──────────────────────────────────────────────────── */}
      {views.length ? (
        <XStack gap="$2" items="center" flexWrap="wrap">
          <Text fontSize="$1" color="$color10">Saved</Text>
          {views.map((v) => (
            <XStack key={v.id} items="center" gap="$1" px="$2" py="$1" rounded="$10" bg="$color3" borderWidth={1} borderColor="$borderColor">
              <Text fontSize="$1" color="$color11" onPress={() => applyView(v)} cursor="pointer">{v.name}</Text>
              <Button size="$1" chromeless icon={<X size={11} />} onPress={() => removeView(v.id)} aria-label={`Remove saved view ${v.name}`} />
            </XStack>
          ))}
        </XStack>
      ) : null}

      {state.phase === 'ready' && all.length === 0 ? (
        <NoApplicationLogs range={rangeLabel} />
      ) : (
        <DataTable
          columns={columns}
          rows={lines}
          loading={state.phase === 'loading'}
          rowKey={(l) => l.id}
          empty="No log lines match the current filters."
        />
      )}

      <Text fontSize="$1" color="$color10">
        Application/platform logs from the Hanzo o11y runtime (OTLP → O11y), org-scoped. Emitted by
        services that ship OpenTelemetry logs; if a service isn&apos;t instrumented yet it won&apos;t appear here.
      </Text>
    </YStack>
  )
}

/** Honest "connected · no logs in window" state — o11y answered, the window is
 *  empty (no OTLP logs ingested for this org yet). Never a fabricated grid. */
function NoApplicationLogs({ range }: { range: string }) {
  const go = (path: string) => {
    if (typeof window !== 'undefined') window.location.assign(path)
  }
  return (
    <Card borderWidth={1} borderColor="$borderColor" p="$4" gap="$2" maxWidth={680}>
      <XStack gap="$2" items="center">
        <Server size={16} />
        <Text fontSize="$4" fontWeight="700">
          Connected · no application logs in the last {range}
        </Text>
      </XStack>
      <Text fontSize="$3" color="$color11">
        The o11y log runtime answered, but no OpenTelemetry logs were ingested for your organization in
        this window. This is a real empty result, not placeholder data — lines appear here as your
        services ship OTLP logs to o11y. Try a wider range, or view your request activity (always real).
      </Text>
      <XStack gap="$2" flexWrap="wrap">
        <Button size="$2" theme="light" icon={<BarChart3 size={15} />} onPress={() => go('/ai-metrics')}>
          View AI Metrics
        </Button>
      </XStack>
    </Card>
  )
}

// ── Request activity lens (commerce usage ledger) ────────────────────────────

type ReqState =
  | { phase: 'loading' }
  | { phase: 'error'; err: ApiError }
  | { phase: 'ready'; records: UsageRecord[] }

function RequestActivityLens() {
  const [state, setState] = useState<ReqState>({ phase: 'loading' })
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [level, setLevel] = useState<string | null>(null)
  const [text, setText] = useState('')

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      const records = await fetchUsageRecords()
      setState({ phase: 'ready', records })
    } catch (e) {
      setState({ phase: 'error', err: asApiError(e) })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const records = state.phase === 'ready' ? state.records : []
  const endpointOptions = useMemo(() => distinctOf(records, (r) => r.model), [records])
  const levelOptions = useMemo(() => distinctOf(records, (r) => r.status), [records])
  const lines = useMemo(
    () =>
      logsFromRecords(records, { endpoint: endpoint ?? 'all', level: level ?? 'all' }, LOG_LIMIT).filter(
        (r) => contains(r.message ?? '', text) || contains(r.endpoint ?? '', text),
      ),
    [records, endpoint, level, text],
  )

  const onExport = useCallback(() => {
    if (!lines.length) return
    exportCSV(
      'request-activity',
      ['Time', 'Endpoint', 'Level', 'Message'],
      lines.map((r) => [r.at ? new Date(r.at).toISOString() : '', r.endpoint, r.level, r.message]),
    )
  }, [lines])

  const columns: Column<LogLine>[] = [
    { key: 'at', header: 'Time', width: 190, render: (r) => <Text fontSize="$2" color="$color11" numberOfLines={1}>{fmtTime(r.at)}</Text> },
    { key: 'endpoint', header: 'Endpoint', width: 200, render: (r) => <Text fontSize="$2" fontWeight="600" numberOfLines={1}>{r.endpoint}</Text> },
    { key: 'level', header: 'Level', width: 110, render: (r) => (r.level ? <StatusTag status={r.level} /> : <Text fontSize="$2" color="$color10">—</Text>) },
    { key: 'message', header: 'Message', render: (r) => <Text fontSize="$2" color="$color11" numberOfLines={1}>{r.message}</Text> },
  ]

  if (state.phase === 'error') {
    return <ErrorState err={state.err} onRetry={() => void load()} />
  }

  return (
    <YStack gap="$3">
      <XStack gap="$2" items="center" flexWrap="wrap" justify="space-between">
        <XStack gap="$2" items="center" flexWrap="wrap">
          <ScrollText size={16} />
          <Text fontSize="$2" color="$color10">Filter</Text>
          <SelectMenu options={endpointOptions} value={endpoint} onChange={setEndpoint} allLabel="All endpoints" />
          <SelectMenu options={levelOptions} value={level} onChange={setLevel} allLabel="All levels" />
          <LogSearch value={text} onChange={setText} />
        </XStack>
        <Button size="$2" chromeless icon={<Download size={14} />} onPress={onExport} disabled={!lines.length} aria-label="Export request activity CSV">
          Export
        </Button>
      </XStack>

      <DataTable
        columns={columns}
        rows={lines}
        loading={state.phase === 'loading'}
        rowKey={(r) => r.id}
        empty="No request activity yet. Requests appear here as your org calls the API."
      />

      <Text fontSize="$1" color="$color10">
        Per-org request log from your usage ledger — one row per billed API/model call.
      </Text>
    </YStack>
  )
}

// ── the product ──────────────────────────────────────────────────────────────

// Request activity (the org's billed API/model calls) is the guaranteed-real lens for
// every org, so it leads and is the default. Application logs (OTLP → O11y) only
// populate once a service ships instrumentation, so it must not be the landing tab.
const LENSES: { key: Lens; label: string }[] = [
  { key: 'requests', label: 'Request activity' },
  { key: 'application', label: 'Application logs' },
]

export function LogsModule(_props: { params: Record<string, string> }) {
  const [lens, setLens] = useState<Lens>('requests')
  const [nonce, setNonce] = useState(0) // remount the active lens to refresh it

  return (
    <>
      <PageHeader
        title="Logs"
        subtitle={
          lens === 'application'
            ? 'Application and platform logs from the o11y runtime.'
            : "Your organization's recent API and model requests."
        }
        actions={
          <XStack gap="$2" items="center" flexWrap="wrap">
            <Segmented value={lens} options={LENSES} onChange={setLens} />
            <Button icon={<RefreshCw size={16} />} onPress={() => setNonce((n) => n + 1)}>
              Refresh
            </Button>
          </XStack>
        }
      />

      {lens === 'application' ? (
        <ApplicationLogsLens key={`app-${nonce}`} />
      ) : (
        <RequestActivityLens key={`req-${nonce}`} />
      )}
    </>
  )
}
