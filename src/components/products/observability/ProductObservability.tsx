'use client'

/**
 * ProductObservability — the ONE reusable per-product o11y panel. Drop it on any
 * product surface with that product's OpenTelemetry `service.name` and it shows
 * THAT product's live signals — RED metrics, recent logs, recent traces — read
 * from the ONE datastore over the ZAP-fed `/v1/o11y` pipeline via the existing
 * `ApmApi` (no new client). Org-scoped by the minted bearer, so it works for a
 * customer too.
 *
 * DRY: one component, config-driven per product (the caller passes `service` +
 * `label`); every product's overview renders it, so native o11y is visible on
 * every product, not just the dedicated Observe section. Honest by construction:
 * a loading skeleton, the shared o11y `RuntimeNotice` on a runtime failure, an
 * honest "connected · no data" empty state, and — when the product has no backing
 * service — an honest managed note. Never fabricated lines or charts.
 */
import { useEffect, useState } from 'react'
import { Button, Card, Text, XStack, YStack } from '@hanzo/gui'
import { Activity, ArrowUpRight, ScrollText, Waypoints } from '@hanzogui/lucide-icons-2'

import { ApmApi, apmWindow, type LogRow, type ServiceHealth, type TraceSpan } from '~/lib/api/apm'
import { MetricCard } from '~/components/ui/Metric'
import { RuntimeNotice } from '~/components/products/observability/RuntimeNotice'
import { formatMetric } from '~/components/products/overview/living/logic'
import { DataTable, type Column } from '@hanzo/ui/product'

const RANGES: { label: string; seconds: number }[] = [
  { label: '15m', seconds: 900 },
  { label: '1h', seconds: 3600 },
  { label: '6h', seconds: 21_600 },
  { label: '24h', seconds: 86_400 },
]

/** Error rate with one decimal — finer than the integer `pct` unit (1.25% ≠ 1%). */
const pct1 = (v: number): string => (Number.isFinite(v) ? `${v.toFixed(1)}%` : '—')
/** ISO → local HH:MM:SS (honest "—" for an unparseable/empty stamp). */
const clock = (iso: string): string => {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? new Date(t).toLocaleTimeString() : '—'
}
const durMs = (nanos: number | null): string => (nanos == null ? '—' : formatMetric(nanos / 1_000_000, 'ms'))

type State = { loading: boolean; error: unknown; health: ServiceHealth | null; logs: LogRow[]; traces: TraceSpan[] }

const LOG_COLS: Column<LogRow>[] = [
  { key: 'timestamp', header: 'Time', width: 108, mono: true, render: (r) => clock(r.timestamp) },
  { key: 'severity', header: 'Level', width: 70, render: (r) => <Text fontSize="$2" color="$color11">{r.severity || '—'}</Text> },
  { key: 'body', header: 'Message', render: (r) => <Text fontSize="$2" numberOfLines={1}>{r.body || '—'}</Text> },
]

const TRACE_COLS: Column<TraceSpan>[] = [
  { key: 'timestamp', header: 'Time', width: 108, mono: true, render: (r) => clock(r.timestamp) },
  { key: 'name', header: 'Operation', render: (r) => <Text fontSize="$2" numberOfLines={1}>{r.name || '—'}</Text> },
  { key: 'durationNano', header: 'Duration', width: 92, align: 'right', mono: true, render: (r) => durMs(r.durationNano) },
  { key: 'status', header: 'Status', width: 84, render: (r) => <Text fontSize="$2" color="$color11">{r.status || '—'}</Text> },
]

export function ProductObservability({
  service,
  label = 'this product',
  range = 3600,
}: {
  service: string | null
  label?: string
  range?: number
}) {
  const [seconds, setSeconds] = useState(range)
  const [st, setSt] = useState<State>({ loading: true, error: null, health: null, logs: [], traces: [] })

  useEffect(() => {
    if (!service) {
      setSt({ loading: false, error: null, health: null, logs: [], traces: [] })
      return
    }
    let alive = true
    setSt((s) => ({ ...s, loading: true, error: null }))
    const w = apmWindow(seconds)
    Promise.all([
      // Health is best-effort — a null (no telemetry) renders honest "—", it must
      // not fail the whole panel. Logs + traces are the primary signal: if the
      // runtime is unreachable they throw → the shared RuntimeNotice.
      ApmApi.serviceHealth(w, service).catch(() => null),
      ApmApi.logs(w, 20, service),
      ApmApi.traceSearch(w, 20, service),
    ])
      .then(([health, logs, traces]) => {
        if (alive) setSt({ loading: false, error: null, health, logs, traces })
      })
      .catch((error) => {
        if (alive) setSt({ loading: false, error, health: null, logs: [], traces: [] })
      })
    return () => {
      alive = false
    }
  }, [service, seconds])

  return (
    <Card p="$4" gap="$4" borderWidth={1} borderColor="$borderColor">
      <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
        <XStack items="center" gap="$2">
          <Activity size={16} />
          <Text fontSize="$5" fontWeight="700">
            Observability
          </Text>
          <Text fontSize="$2" color="$color10">
            {service ? `service: ${service}` : 'managed'}
          </Text>
        </XStack>
        <XStack items="center" gap="$2" flexWrap="wrap">
          {service ? (
            <XStack gap="$1">
              {RANGES.map((r) => (
                <Button
                  key={r.label}
                  size="$1"
                  chromeless={seconds !== r.seconds}
                  bg={seconds === r.seconds ? '$color5' : 'transparent'}
                  onPress={() => setSeconds(r.seconds)}
                >
                  {r.label}
                </Button>
              ))}
            </XStack>
          ) : null}
          <Button
            size="$1"
            chromeless
            iconAfter={<ArrowUpRight size={13} opacity={0.5} />}
            onPress={() => typeof window !== 'undefined' && window.location.assign('/traces')}
          >
            Observe
          </Button>
        </XStack>
      </XStack>

      {!service ? (
        <Text fontSize="$3" color="$color11">
          {label} is a managed surface with no dedicated telemetry service — its signals roll up under the
          platform-wide Observe views.
        </Text>
      ) : st.error ? (
        <RuntimeNotice surface="observability" error={st.error} />
      ) : (
        <>
          {/* RED metrics — real per-service health, honest "—" when no telemetry. */}
          <XStack gap="$3" flexWrap="wrap">
            <YStack flex={1} minW={150}>
              <MetricCard icon={<Activity size={15} />} label="Requests" value={st.health ? formatMetric(st.health.numCalls, 'count') : '—'} caption={st.loading ? 'loading…' : `last ${RANGES.find((r) => r.seconds === seconds)?.label ?? ''}`} />
            </YStack>
            <YStack flex={1} minW={150}>
              <MetricCard icon={<Activity size={15} />} label="Error rate" value={st.health ? pct1(st.health.errorRatePct) : '—'} caption={st.health ? st.health.tone : 'no telemetry'} />
            </YStack>
            <YStack flex={1} minW={150}>
              <MetricCard icon={<Activity size={15} />} label="p99 latency" value={st.health ? formatMetric(st.health.p99Ms, 'ms') : '—'} caption={st.health ? `avg ${formatMetric(st.health.avgMs, 'ms')}` : ''} />
            </YStack>
            <YStack flex={1} minW={150}>
              <MetricCard icon={<Activity size={15} />} label="Req / s" value={st.health ? formatMetric(st.health.callRate, 'count') : '—'} caption="throughput" />
            </YStack>
          </XStack>

          {/* Recent logs — real OTLP lines for this service. */}
          <YStack gap="$2">
            <XStack items="center" gap="$2">
              <ScrollText size={14} />
              <Text fontSize="$3" fontWeight="700">
                Recent logs
              </Text>
            </XStack>
            <DataTable
              columns={LOG_COLS}
              rows={st.logs}
              loading={st.loading}
              rowKey={(r) => r.id}
              empty={`Connected · no logs for ${label} in the last ${RANGES.find((r) => r.seconds === seconds)?.label ?? 'window'}.`}
            />
          </YStack>

          {/* Recent traces — real spans for this service. */}
          <YStack gap="$2">
            <XStack items="center" gap="$2">
              <Waypoints size={14} />
              <Text fontSize="$3" fontWeight="700">
                Recent traces
              </Text>
            </XStack>
            <DataTable
              columns={TRACE_COLS}
              rows={st.traces}
              loading={st.loading}
              rowKey={(r) => r.id}
              empty={`Connected · no traces for ${label} in the last ${RANGES.find((r) => r.seconds === seconds)?.label ?? 'window'}.`}
            />
          </YStack>
        </>
      )}
    </Card>
  )
}
