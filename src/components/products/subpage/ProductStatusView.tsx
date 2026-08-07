'use client'

/**
 * Per-product Status — the REAL health of THIS product, from TWO orthogonal, live
 * sources, each honest by construction (never a fabricated green):
 *
 *  1. o11y (O11y) RED metrics for the product's OTel `service.name`
 *     (`ApmApi.serviceHealth`, org-scoped by the minted bearer) — the "is it serving
 *     traffic and healthy" signal: call rate, error rate, p99 latency, rolled to a
 *     green/yellow/red verdict. This works for a CUSTOMER too (o11y scopes by the JWT
 *     owner), unlike the admin-only control-plane inventory. Absent (no telemetry in
 *     the window) → the band is simply omitted, never a fake verdict.
 *
 *  2. The platform apps inventory (`PlatformApi.apps()`, the SAME source the native
 *     overview health band + the global Status board read), filtered to the product's
 *     operator service — its deployment state per env (running tag · cluster · drift ·
 *     health). Admin-scoped: a customer 403 simply omits the table.
 *
 * If BOTH are empty the product has no discrete service reporting → an honest managed
 * card. The two reads are independent (one failing never blanks the other).
 */
import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import { Activity, CheckCircle2, RefreshCw } from '@hanzogui/lucide-icons-2'

import type { CatalogEntry } from '~/lib/products/registry'
import { PlatformApi, type PlatformApp } from '~/lib/api/platform'
import { ApmApi, apmWindow, type ServiceHealth } from '~/lib/api/apm'
import { interpretPlatformError, PlatformStateCard, type PlatformError } from '../platform/state'
import { subpageSourcesFor } from './sources'
import { toneVar } from '~/components/ui/tone'
import { DataTable, PageHeader, StatusTag, type Column } from '@hanzo/ui/product'

type DeployState =
  | { phase: 'loading' }
  | { phase: 'error'; error: PlatformError }
  | { phase: 'ready'; rows: PlatformApp[] }

/** o11y health: loading → resolved (a ServiceHealth, or null when no telemetry / unreachable). */
type O11yState = { phase: 'loading' } | { phase: 'ready'; health: ServiceHealth | null }

const isUp = (a: PlatformApp): boolean => a.health === 'green'

/** Roll the (possibly multi-env) deployment rows into one verdict. */
function verdict(apps: PlatformApp[]): { tone: 'green' | 'yellow' | 'red'; label: string } {
  if (apps.some((a) => a.health === 'red')) return { tone: 'red', label: 'Degraded' }
  if (apps.some((a) => a.health === 'yellow')) return { tone: 'yellow', label: 'Partial' }
  return { tone: 'green', label: 'Operational' }
}

const TONE_DOT = { green: toneVar('positive'), yellow: toneVar('warning'), red: toneVar('critical') } as const
const HEALTH_WORD = { green: 'Healthy', yellow: 'Elevated errors', red: 'Degraded' } as const

const fmtRate = (n: number): string => (n >= 100 ? Math.round(n).toString() : n.toFixed(n >= 10 ? 1 : 2))
const fmtMs = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${Math.round(n)}ms`)

export function ProductStatusView({ entry }: { entry: CatalogEntry }) {
  const { service, o11yService } = subpageSourcesFor(entry)
  const [deploy, setDeploy] = useState<DeployState>({ phase: 'loading' })
  const [o11y, setO11y] = useState<O11yState>({ phase: 'loading' })

  const load = useCallback(() => {
    // Source 1 — LIVE o11y RED metrics (org-scoped; works for customers). Unreachable /
    // not-enabled / no-telemetry all resolve to `null` → the band is omitted, never faked.
    if (o11yService) {
      setO11y({ phase: 'loading' })
      ApmApi.serviceHealth(apmWindow(3600), o11yService, service)
        .then((health) => setO11y({ phase: 'ready', health }))
        .catch(() => setO11y({ phase: 'ready', health: null }))
    } else {
      setO11y({ phase: 'ready', health: null })
    }

    // Source 2 — deployment state (admin-scoped control-plane inventory).
    if (service) {
      setDeploy({ phase: 'loading' })
      PlatformApi.apps()
        .then((all) => setDeploy({ phase: 'ready', rows: all.filter((a) => a.app === service) }))
        .catch((e) => setDeploy({ phase: 'error', error: interpretPlatformError(e) }))
    } else {
      setDeploy({ phase: 'ready', rows: [] })
    }
  }, [service, o11yService])

  useEffect(() => {
    load()
  }, [load])

  const columns: Column<PlatformApp>[] = [
    { key: 'env', header: 'Environment', width: 120, render: (r) => <Text fontSize="$3" fontWeight="600">{r.env}</Text> },
    { key: 'cluster', header: 'Cluster', render: (r) => <Text fontSize="$3" color="$color11" numberOfLines={1}>{r.cluster}</Text> },
    { key: 'namespace', header: 'Namespace', width: 140, render: (r) => <Text fontSize="$3" color="$color11" numberOfLines={1}>{r.namespace ?? '—'}</Text> },
    { key: 'runningTag', header: 'Running', width: 150, render: (r) => <Text fontSize="$2" color="$color11" numberOfLines={1}>{r.runningTag ?? '—'}</Text> },
    { key: 'health', header: 'Health', width: 110, render: (r) => <StatusTag status={r.health} /> },
  ]

  const health = o11y.phase === 'ready' ? o11y.health : null
  const deployRows = deploy.phase === 'ready' ? deploy.rows : []
  const loading = o11y.phase === 'loading' || deploy.phase === 'loading'
  // The honest managed card shows only when NEITHER source has anything to report.
  const nothingToReport = deploy.phase !== 'error' && !health && deployRows.length === 0 && !loading

  return (
    <>
      <PageHeader
        title={`${entry.label} · Status`}
        subtitle={`Live health of ${entry.label} — traffic (o11y) and deployment across your clusters.`}
        actions={
          <Button icon={<RefreshCw size={16} />} onPress={load}>
            Refresh
          </Button>
        }
      />

      {loading ? (
        <XStack p="$4" gap="$2" items="center">
          <Spinner />
          <Text color="$color11">Probing {entry.label}…</Text>
        </XStack>
      ) : (
        <YStack gap="$3">
          {/* Source 1 — LIVE o11y RED-metrics health band (real serving health, org-scoped). */}
          {health ? <O11yHealthBand label={entry.label} health={health} /> : null}

          {/* Source 2 — deployment state (admin control-plane inventory). */}
          {deploy.phase === 'error' ? (
            // Only surface the deployment error when o11y didn't already give a real verdict —
            // a customer 403 on the admin inventory is not an error when we have live o11y health.
            health ? null : <PlatformStateCard error={deploy.error} onRetry={load} />
          ) : deployRows.length > 0 ? (
            <YStack gap="$3">
              {(() => {
                const v = verdict(deployRows)
                return (
                  <Card borderWidth={1} borderColor="$borderColor" p="$3.5" gap="$2.5" maxWidth={720}>
                    <XStack items="center" gap="$2" flexWrap="wrap">
                      <YStack width={10} height={10} rounded="$10" style={{ backgroundColor: TONE_DOT[v.tone] }} />
                      <Text fontSize="$5" fontWeight="800" color="$color12">{v.label}</Text>
                      <Text fontSize="$2" color="$color10">
                        · deployment · {deployRows.filter(isUp).length}/{deployRows.length} healthy ·{' '}
                        {new Set(deployRows.map((r) => r.cluster)).size}{' '}
                        {new Set(deployRows.map((r) => r.cluster)).size === 1 ? 'cluster' : 'clusters'}
                      </Text>
                    </XStack>
                  </Card>
                )
              })()}
              <DataTable
                columns={columns}
                rows={deployRows}
                rowKey={(r) => r.id}
                empty={`No running ${entry.label} service reported for your organization.`}
              />
            </YStack>
          ) : null}

          {nothingToReport ? <ManagedCard entry={entry} hasService={Boolean(service || o11yService)} /> : null}
        </YStack>
      )}
    </>
  )
}

/** LIVE o11y RED-metrics band — real "is it serving traffic and healthy" for the org. */
function O11yHealthBand({ label, health }: { label: string; health: ServiceHealth }) {
  return (
    <Card borderWidth={1} borderColor="$borderColor" p="$3.5" gap="$2.5" maxWidth={720}>
      <XStack items="center" gap="$2" flexWrap="wrap">
        <YStack width={10} height={10} rounded="$10" style={{ backgroundColor: TONE_DOT[health.tone] }} />
        <Text fontSize="$5" fontWeight="800" color="$color12">{HEALTH_WORD[health.tone]}</Text>
        <Text fontSize="$2" color="$color10">· serving traffic · last hour</Text>
      </XStack>
      <XStack gap="$5" flexWrap="wrap">
        <Metric label="Requests/s" value={fmtRate(health.callRate)} icon />
        <Metric label="Error rate" value={`${fmtRate(health.errorRatePct)}%`} tone={health.tone === 'green' ? undefined : health.tone} />
        <Metric label="p99 latency" value={fmtMs(health.p99Ms)} />
        <Metric label="Requests" value={health.numCalls.toLocaleString()} />
      </XStack>
      <Text fontSize="$1" color="$color10">
        Live RED metrics from the o11y runtime for service{' '}
        <Text fontSize="$1" color="$color11" fontWeight="600">{health.service}</Text>, scoped to your organization. {label} is
        serving traffic.
      </Text>
    </Card>
  )
}

function Metric({ label, value, tone, icon }: { label: string; value: string; tone?: 'yellow' | 'red'; icon?: boolean }) {
  const color = tone === 'red' ? '$red10' : tone === 'yellow' ? '$yellow10' : '$color12'
  return (
    <YStack gap="$0.5">
      <XStack gap="$1" items="center">
        {icon ? <Activity size={12} color="$color10" /> : null}
        <Text fontSize="$1" color="$color10">{label}</Text>
      </XStack>
      <Text fontSize="$5" fontWeight="800" color={color}>{value}</Text>
    </YStack>
  )
}

/** Honest managed-capability card — no discrete service reports to either source. */
function ManagedCard({ entry, hasService }: { entry: CatalogEntry; hasService: boolean }) {
  return (
    <Card borderWidth={1} borderColor="$borderColor" p="$4" gap="$2" maxWidth={640}>
      <XStack gap="$2" items="center">
        <CheckCircle2 size={16} color="$green10" />
        <Text fontSize="$4" fontWeight="700">
          {hasService ? `${entry.label} · no telemetry reported` : `${entry.label} · managed by Hanzo`}
        </Text>
      </XStack>
      <Text fontSize="$3" color="$color11">
        {hasService
          ? `Neither the o11y runtime nor the control-plane inventory reports a running ${entry.label} service for your organization right now. It may be a shared managed service reported elsewhere, or idle in this window — its live health lights up automatically once it serves traffic or is reported.`
          : `${entry.label} is a managed Hanzo Cloud capability with no discrete service to report health for. It is available through the API.`}
      </Text>
    </Card>
  )
}
