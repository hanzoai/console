'use client'

/**
 * The three neighbouring planes a deploy touches, and the domains it publishes on.
 *
 * Each reads the ONE canonical head for its subject — there is no `/v1/platform/cd`,
 * `/v1/platform/ci`, or `/v1/platform/s3`, and inventing those aliases would give
 * the estate two paths to the same data:
 *
 *   CD      → `GET /v1/deploy/applications` (`GitopsApi`). The reconciliation
 *             projection over the operator's App CRs — sync + health per app.
 *             Tenant-scoped server-side: a member sees only its own org's apps.
 *   CI      → `GET /v1/builds` (`BuildsApi`). The native build record written by
 *             git push → Actions → image. There is no forge-runs endpoint.
 *   Storage → `GET /v1/s3/buckets` (`StorageApi`). Org-scoped object storage.
 *   Domains → the hosts already bound to this org's apps and sites, folded from
 *             the board rather than re-fetched per app.
 *
 * Each panel is a READING, deep-linking to the product that owns the subject for
 * anything deeper. None of them duplicates that product's controls, so there is
 * still exactly one place to sync a CR, browse an object, or edit a build.
 */
import { useCallback, useEffect, useState } from 'react'
import { Button, Text, XStack, YStack } from '@hanzo/gui'
import { RefreshCw, ExternalLink } from '@hanzogui/lucide-icons-2'
import { useRouter } from 'next/navigation'

import { GitopsApi, type Application } from '~/lib/api/gitops'
import { BuildsApi, type Build } from '~/lib/api/builds'
import { StorageApi, type Bucket } from '~/lib/api/storage'
import { DataTable, StatusTag, type Column } from '@hanzo/ui/product'
import { interpretPlatformError, PlatformStateCard, type PlatformError } from '../platform/state'
import { hostRows, partialNote, type DeployKind, type DeployRow, type HostRow } from '~/lib/deploy/board'

/** Epoch ms → local string; an em dash when the backend had no timestamp. */
const when = (ms?: number): string => (ms ? new Date(ms).toLocaleString() : '—')
/** An ISO/RFC3339 string → local; the raw value when it will not parse. */
const whenIso = (iso?: string): string => {
  if (!iso) return '—'
  const t = Date.parse(iso)
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString()
}

/**
 * One load of one list. Every panel here has the same shape — read a head, keep
 * the rows, classify a failure honestly — so it is written once.
 */
function useList<T>(read: () => Promise<T[]>): {
  rows: T[]
  loading: boolean
  error: PlatformError | null
  reload: () => Promise<void>
} {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PlatformError | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await read())
      setError(null)
    } catch (e) {
      setError(interpretPlatformError(e))
      setRows([])
    } finally {
      setLoading(false)
    }
    // `read` is a stable module-level call in every caller; re-running on identity
    // would refetch on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { rows, loading, error, reload: load }
}

/** Header strip shared by the panels: one sentence of context + Refresh. */
function PanelHead({ title, note, onRefresh }: { title: string; note: string; onRefresh: () => void }) {
  return (
    <XStack justify="space-between" items="flex-start" gap="$3" flexWrap="wrap">
      <YStack flex={1} minW={0} gap="$1">
        <Text fontSize="$6" fontWeight="600" color="$color12">
          {title}
        </Text>
        <Text fontSize="$2" color="$color10">
          {note}
        </Text>
      </YStack>
      <Button size="$2" icon={<RefreshCw size={15} />} onPress={onRefresh}>
        Refresh
      </Button>
    </XStack>
  )
}

// ── CD ───────────────────────────────────────────────────────────────────────

export function CdPanel() {
  const { rows, loading, error, reload } = useList<Application>(GitopsApi.applications)

  const columns: Column<Application>[] = [
    {
      key: 'name',
      header: 'Application',
      render: (a) => (
        <YStack gap="$0.5" minW={0}>
          <Text fontSize="$3" fontWeight="600" color="$color12" numberOfLines={1}>
            {a.name}
          </Text>
          <Text fontSize="$1" color="$color10" numberOfLines={1}>
            {a.namespace}
          </Text>
        </YStack>
      ),
    },
    { key: 'sync', header: 'Sync', width: 120, render: (a) => <StatusTag status={a.sync} /> },
    { key: 'health', header: 'Health', width: 120, render: (a) => <StatusTag status={a.health} /> },
    {
      key: 'tag',
      header: 'Declared → running',
      width: 220,
      mono: true,
      render: (a) => (
        <Text fontSize="$2" color="$color11" numberOfLines={1} className="hz-mono">
          {a.image.tag || '—'}
          {a.liveTag && a.liveTag !== a.image.tag ? ` → ${a.liveTag}` : ''}
        </Text>
      ),
    },
    {
      key: 'replicas',
      header: 'Ready',
      width: 90,
      align: 'right',
      render: (a) => (
        <Text fontSize="$3" color="$color11" className="hz-mono">
          {a.readyReplicas}/{a.replicas}
        </Text>
      ),
    },
  ]

  return (
    <YStack gap="$3.5" data-testid="deploy-panel-cd">
      <PanelHead
        title="CD"
        note="Reconciliation of your apps, read from the operator's App CRs — the same plane cd.hanzo.ai serves."
        onRefresh={() => void reload()}
      />
      {error ? (
        <PlatformStateCard error={error} onRetry={() => void reload()} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          rowKey={(a) => `${a.namespace}/${a.name}`}
          empty="Nothing reconciled here yet."
        />
      )}
    </YStack>
  )
}

// ── CI ───────────────────────────────────────────────────────────────────────

export function CiPanel() {
  const { rows, loading, error, reload } = useList<Build>(BuildsApi.list)

  const columns: Column<Build>[] = [
    {
      key: 'repo',
      header: 'Repository',
      render: (b) => (
        <Text fontSize="$3" fontWeight="600" color="$color12" numberOfLines={1}>
          {b.repo || b.id || '—'}
        </Text>
      ),
    },
    {
      key: 'commit',
      header: 'Commit',
      width: 130,
      mono: true,
      render: (b) => (
        <Text fontSize="$2" color="$color11" numberOfLines={1} className="hz-mono">
          {b.commit ? b.commit.slice(0, 12) : '—'}
        </Text>
      ),
    },
    {
      key: 'tag',
      header: 'Tag',
      width: 150,
      mono: true,
      render: (b) => (
        <Text fontSize="$2" color="$color11" numberOfLines={1} className="hz-mono">
          {b.tag || '—'}
        </Text>
      ),
    },
    { key: 'status', header: 'Status', width: 120, render: (b) => <StatusTag status={b.status || 'unknown'} /> },
    {
      key: 'startedAt',
      header: 'Started',
      width: 190,
      render: (b) => (
        <Text fontSize="$3" color="$color11" numberOfLines={1}>
          {whenIso(b.startedAt)}
        </Text>
      ),
    },
    {
      key: 'duration',
      header: 'Took',
      width: 90,
      align: 'right',
      render: (b) => (
        <Text fontSize="$3" color="$color11">
          {b.duration || '—'}
        </Text>
      ),
    },
  ]

  return (
    <YStack gap="$3.5" data-testid="deploy-panel-ci">
      <PanelHead
        title="CI"
        note="Builds your pushes produced — commit to image, on the native runners."
        onRefresh={() => void reload()}
      />
      {error ? (
        <PlatformStateCard error={error} onRetry={() => void reload()} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          rowKey={(b) => b.id || `${b.repo}@${b.commit}`}
          empty="No builds recorded yet."
        />
      )}
    </YStack>
  )
}

// ── Storage ──────────────────────────────────────────────────────────────────

export function StoragePanel() {
  const router = useRouter()
  const { rows, loading, error, reload } = useList<Bucket>(StorageApi.buckets)

  const columns: Column<Bucket>[] = [
    {
      key: 'name',
      header: 'Bucket',
      render: (b) => (
        <Text fontSize="$3" fontWeight="600" color="$color12" numberOfLines={1}>
          {b.name}
        </Text>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: 200,
      // The backend carries Unix SECONDS here, unlike the ms timestamps the
      // platform rows use.
      render: (b) => (
        <Text fontSize="$3" color="$color11">
          {when(b.createdAt ? b.createdAt * 1000 : undefined)}
        </Text>
      ),
    },
  ]

  return (
    <YStack gap="$3.5" data-testid="deploy-panel-storage">
      <PanelHead
        title="Storage"
        note="Object storage in your org — where a static site's build is served from."
        onRefresh={() => void reload()}
      />
      {error ? (
        <PlatformStateCard error={error} onRetry={() => void reload()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            rowKey={(b) => b.name}
            onRowPress={(b) => router.push(`/s3?bucket=${encodeURIComponent(b.name)}`)}
            empty="No buckets yet."
          />
          <Button size="$2" self="flex-start" icon={<ExternalLink size={15} />} onPress={() => router.push('/s3')}>
            Open the file manager
          </Button>
        </>
      )}
    </YStack>
  )
}

// ── Domains ──────────────────────────────────────────────────────────────────

export function DomainsPanel({
  rows,
  loading,
  incomplete,
  onRefresh,
}: {
  rows: DeployRow[]
  loading: boolean
  /** Sources the board could not fully read — this list inherits their gaps. */
  incomplete: DeployKind[]
  onRefresh: () => void
}) {
  const hosts = hostRows(rows)
  // The host list is derived from the board's rows, so a half-loaded board is a
  // half-loaded domain list. Saying so matters more here than anywhere else: a
  // missing host reads as "nothing is bound", which is the opposite of the truth.
  const note = partialNote(incomplete)

  const columns: Column<HostRow>[] = [
    {
      key: 'host',
      header: 'Host',
      render: (h) => (
        <Text fontSize="$3" fontWeight="600" color="$color12" numberOfLines={1}>
          {h.host}
        </Text>
      ),
    },
    {
      key: 'owner',
      header: 'Serves',
      width: 220,
      render: (h) => (
        <Text fontSize="$3" color="$color11" numberOfLines={1}>
          {h.owner}
        </Text>
      ),
    },
    {
      key: 'kind',
      header: 'Type',
      width: 110,
      render: (h) => (
        <Text fontSize="$3" color="$color11">
          {h.kind === 'app' ? 'App' : 'Site'}
        </Text>
      ),
    },
    { key: 'status', header: 'Status', width: 120, render: (h) => <StatusTag status={h.status} /> },
  ]

  return (
    <YStack gap="$3.5" data-testid="deploy-panel-domains">
      <PanelHead
        title="Domains"
        note="Every host serving one of your deployments. Bind a custom host when you deploy; it stays pending until DNS proves ownership."
        onRefresh={onRefresh}
      />
      {note ? (
        <Text fontSize="$2" color="$color11" role="status">
          {note}
        </Text>
      ) : null}
      <DataTable
        columns={columns}
        rows={hosts}
        loading={loading}
        rowKey={(h) => h.host}
        empty="No hosts bound yet."
      />
    </YStack>
  )
}
