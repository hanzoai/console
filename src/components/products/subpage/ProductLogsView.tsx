'use client'

/**
 * Per-product Logs — the LIVE application/platform logs for THIS product's OTel
 * service, read from the Hanzo o11y (O11y) runtime via the same-origin `/v1`
 * bearer proxy (`POST /v1/o11y/query_range` — the version-less canonical o11y
 * surface; a `list`-panel `noop` builder query over `dataSource: logs`, newest first,
 * FILTERED to the product's
 * `service.name`). The SAME o11y source the Observe › Logs board reads, scoped to
 * one product — org-scoped by the minted bearer, so a customer sees only their own
 * org's lines (o11y scopes every query by the JWT owner → `X-Org-Id`).
 *
 * DRY: reuses `ApmApi.logs(window, limit, service)` + the shared o11y `RuntimeNotice`
 * — there is ONE o11y client and ONE empty-state card, parameterized per product.
 * The rows are additionally re-filtered client-side to the product's service, so a
 * runtime that ignored the filter can never leak another service's lines here.
 *
 * States:
 *  - product with no dedicated service → the logs surface in its empty state (a
 *    calm "no logs yet" card), never a dead end;
 *  - o11y 503 (initializing) / 404 (unrouted) / 401 (session) / 403 (not enabled) →
 *    the shared `RuntimeNotice` (names the reason + endpoint);
 *  - o11y answered but the window is empty (the service ships no OTLP logs yet) →
 *    a "no logs in the last <range>" card.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Text, XStack, YStack } from '@hanzo/gui'
import { RefreshCw, ScrollText, Server } from '@hanzogui/lucide-icons-2'

import type { CatalogEntry } from '~/lib/products/registry'
import type { ApiError } from '~/lib/api'
import { asApiError } from '~/components/ui/States'
import { ApmApi, apmWindow, type LogRow } from '~/lib/api/apm'
import { RuntimeNotice } from '../observability/RuntimeNotice'
import { subpageSourcesFor } from './sources'
import { DataTable, PageHeader, SelectMenu, StatusTag, type Column, type SelectOption } from '@hanzo/ui/product'

const RANGES: { key: string; label: string; seconds: number }[] = [
  { key: '15m', label: '15m', seconds: 900 },
  { key: '1h', label: '1h', seconds: 3600 },
  { key: '6h', label: '6h', seconds: 21_600 },
  { key: '24h', label: '24h', seconds: 86_400 },
]

/** Distinct, sorted values for a filter dropdown (blank values dropped). */
function distinctOf(rows: LogRow[], pick: (r: LogRow) => string): SelectOption<string>[] {
  const seen = new Set<string>()
  for (const r of rows) {
    const v = pick(r)
    if (v) seen.add(v)
  }
  return [...seen].sort().map((v) => ({ key: v, label: v }))
}

/** Small segmented control for the range toggle. */
function Segmented({ value, options, onChange }: { value: string; options: { key: string; label: string }[]; onChange: (v: string) => void }) {
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

type State = { phase: 'loading' } | { phase: 'error'; err: ApiError } | { phase: 'ready'; lines: LogRow[] }

export function ProductLogsView({ entry }: { entry: CatalogEntry }) {
  const { o11yService } = subpageSourcesFor(entry)
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [rangeIdx, setRangeIdx] = useState(1) // default 1h
  const [severity, setSeverity] = useState<string | null>(null)

  const load = useCallback(
    async (idx: number) => {
      if (!o11yService) {
        setState({ phase: 'ready', lines: [] })
        return
      }
      setState({ phase: 'loading' })
      try {
        const lines = await ApmApi.logs(apmWindow(RANGES[idx].seconds), 500, o11yService)
        setState({ phase: 'ready', lines })
      } catch (e) {
        setState({ phase: 'error', err: asApiError(e) })
      }
    },
    [o11yService],
  )

  useEffect(() => {
    void load(rangeIdx)
  }, [load, rangeIdx])

  const all = state.phase === 'ready' ? state.lines : []
  const severityOptions = useMemo(() => distinctOf(all, (l) => l.severity), [all])
  const lines = useMemo(() => all.filter((l) => !severity || l.severity === severity), [all, severity])

  const columns: Column<LogRow>[] = [
    { key: 'time', header: 'Time', width: 200, render: (l) => <Text fontSize="$2" color="$color11" numberOfLines={1}>{l.timestamp ? new Date(l.timestamp).toLocaleString() : '—'}</Text> },
    { key: 'severity', header: 'Severity', width: 110, render: (l) => (l.severity ? <StatusTag status={l.severity} /> : <Text fontSize="$2" color="$color10">—</Text>) },
    { key: 'body', header: 'Message', render: (l) => <Text fontSize="$2" color="$color11" numberOfLines={1}>{l.body || '—'}</Text> },
  ]

  const hasService = Boolean(o11yService)
  return (
    <>
      <PageHeader
        title={`${entry.label} · Logs`}
        subtitle={
          hasService
            ? `Live application logs for the ${entry.label} service, from the o11y runtime.`
            : `Application logs for ${entry.label}.`
        }
        actions={
          <Button icon={<RefreshCw size={16} />} onPress={() => void load(rangeIdx)}>
            Refresh
          </Button>
        }
      />

      {state.phase === 'error' ? (
        <RuntimeNotice surface="logs" error={state.err} />
      ) : (
        <YStack gap="$3">
          {/* The range + severity controls only make sense against a live service; a
              managed capability with no service shows the empty surface alone. */}
          {hasService ? (
            <XStack gap="$3" items="center" flexWrap="wrap" justify="space-between">
              <XStack gap="$2" items="center" flexWrap="wrap">
                <ScrollText size={16} />
                <Text fontSize="$2" color="$color10">Range</Text>
                <Segmented value={RANGES[rangeIdx].key} options={RANGES} onChange={(k) => setRangeIdx(RANGES.findIndex((r) => r.key === k))} />
              </XStack>
              <SelectMenu options={severityOptions} value={severity} onChange={setSeverity} allLabel="All severities" />
            </XStack>
          ) : null}

          {state.phase === 'ready' && all.length === 0 ? (
            <NoLogs entry={entry} range={hasService ? RANGES[rangeIdx].label : null} service={o11yService} />
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
            Application logs from the Hanzo o11y runtime (OTLP), scoped to{' '}
            {hasService ? (
              <>
                service <Text fontSize="$1" color="$color11" fontWeight="600">{o11yService}</Text> and your organization. Lines
                appear here as {entry.label} emits them.
              </>
            ) : (
              <>your organization. Lines appear here as {entry.label} emits them.</>
            )}
          </Text>
        </YStack>
      )}
    </>
  )
}

/**
 * Empty logs surface. Two shapes, one card:
 *  - a product WITH a service, whose window came back empty → "no logs in the last <range>";
 *  - a managed capability with no dedicated service → a calm "no logs yet".
 */
function NoLogs({ entry, range, service }: { entry: CatalogEntry; range: string | null; service: string | null }) {
  const connected = Boolean(service)
  return (
    <Card borderWidth={1} borderColor="$borderColor" p="$4" gap="$2" maxWidth={680}>
      <XStack gap="$2" items="center">
        <Server size={16} color={connected ? undefined : '$color10'} />
        <Text fontSize="$4" fontWeight="700">
          {connected ? `No logs for ${entry.label} in the last ${range}` : 'No logs yet'}
        </Text>
      </XStack>
      <Text fontSize="$3" color="$color11">
        {connected ? (
          <>
            The o11y runtime is connected, but service{' '}
            <Text fontSize="$3" color="$color12" fontWeight="600">{service}</Text> shipped no logs for your organization in this
            window. Lines appear here as {entry.label} emits them — try a wider range.
          </>
        ) : (
          <>
            {entry.label} is a managed capability with no dedicated service. Application logs appear here as it emits them to the
            o11y runtime.
          </>
        )}
      </Text>
    </Card>
  )
}
