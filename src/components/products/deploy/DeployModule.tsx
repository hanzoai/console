'use client'

/**
 * Deploy — the front door for shipping something.
 *
 * One section over the two things an org deploys (container apps and static
 * sites) plus readings of the three planes a deploy touches (CD, CI, Storage) and
 * the hosts it publishes on. The level-2 slugs come from the ONE registry
 * declaration, so the sidebar rail, this strip, and ⌘K cannot disagree about
 * which tabs exist.
 *
 * It COMPOSES; it does not re-implement. Apps come from `PaasApi`, sites from
 * `PlatformSitesApi`, reconciliation from `GitopsApi`, builds from `BuildsApi`,
 * buckets from `StorageApi` — the same typed clients the deeper products already
 * use, over the same same-origin `/v1` bearer proxy, which resolves the org from
 * the token owner server-side. No new backend path, no new credential, and no
 * client-side org filter standing in for a boundary.
 */
import { useState } from 'react'
import { Button, Text, XStack, YStack } from '@hanzo/gui'
import { AppWindow, Globe, Layers, Plus, RefreshCw, Rocket } from '@hanzogui/lucide-icons-2'
import { useRouter } from 'next/navigation'

import { DataTable, MetricCard, PageHeader, PrimaryButton, StatusTag, type Column } from '@hanzo/ui/product'
import { SubNav } from '~/components/ui/SubNav'
import { productSubpageSlug } from '~/lib/products/match'
import { partialNote, summarize, type DeployKind, type DeployRow } from '~/lib/deploy/board'
import { PlatformStateCard } from '../platform/state'
import { useBoard } from './useBoard'
import { NewDeploy } from './NewDeploy'
import { CdPanel, CiPanel, DomainsPanel, StoragePanel } from './panels'

const SUBTITLE: Record<string, string> = {
  '': 'Ship an app or a static site, and watch it go live.',
  apps: 'Container workloads the operator reconciles for you.',
  sites: 'Static builds served straight from object storage.',
}

export function DeployModule({ params }: { params: Record<string, string> }) {
  const tab = productSubpageSlug('deploy', params.tab)
  const board = useBoard()
  const [creating, setCreating] = useState(false)

  const panel = (() => {
    switch (tab) {
      case 'cd':
        return <CdPanel />
      case 'ci':
        return <CiPanel />
      case 'storage':
        return <StoragePanel />
      case 'domains':
        return (
          <DomainsPanel
            rows={board.rows}
            loading={board.loading}
            incomplete={board.incomplete}
            onRefresh={() => void board.reload()}
          />
        )
      case 'apps':
        return <BoardView board={board} only="app" />
      case 'sites':
        return <BoardView board={board} only="site" />
      default:
        return <BoardView board={board} />
    }
  })()

  return (
    <>
      <PageHeader
        title="Deploy"
        subtitle={SUBTITLE[tab] ?? 'Everything you have shipped, and the planes that carry it.'}
        actions={
          <XStack gap="$2">
            <Button size="$2" icon={<RefreshCw size={15} />} onPress={() => void board.reload()}>
              Refresh
            </Button>
            <PrimaryButton size="$2" icon={<Plus size={15} />} onPress={() => setCreating((c) => !c)}>
              New deployment
            </PrimaryButton>
          </XStack>
        }
      />

      <SubNav id="deploy" />

      {creating ? (
        <NewDeploy
          onCancel={() => setCreating(false)}
          onDeployed={() => {
            setCreating(false)
            void board.reload()
          }}
        />
      ) : null}

      {panel}
    </>
  )
}

/** The unified board, optionally narrowed to one kind (the Apps / Sites tabs). */
function BoardView({ board, only }: { board: ReturnType<typeof useBoard>; only?: DeployKind }) {
  const router = useRouter()
  const rows = only ? board.rows.filter((r) => r.kind === only) : board.rows
  const totals = summarize(board.rows)
  const note = partialNote(board.incomplete)
  // A count over a source that did not fully load is a FLOOR, not a total. Showing
  // "Apps 0" beside "apps could not be loaded" states a number the board does not
  // know, so the unreliable tiles read an em dash instead.
  const missingApps = board.incomplete.includes('app')
  const missingSites = board.incomplete.includes('site')
  const count = (n: number, unreliable: boolean): string => (unreliable ? '—' : String(n))

  const columns: Column<DeployRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (r) => (
        <YStack gap="$0.5" minW={0}>
          <Text fontSize="$3" fontWeight="600" color="$color12" numberOfLines={1}>
            {r.name}
          </Text>
          <Text fontSize="$1" color="$color10" numberOfLines={1}>
            {r.kind === 'app' ? (r.project ? `App · ${r.project}` : 'App') : 'Static site'}
          </Text>
        </YStack>
      ),
    },
    {
      key: 'host',
      header: 'Host',
      width: 260,
      render: (r) =>
        r.host ? (
          <Text fontSize="$3" color="$color11" numberOfLines={1}>
            {r.host}
          </Text>
        ) : (
          <Text fontSize="$3" color="$color10">
            —
          </Text>
        ),
    },
    { key: 'status', header: 'Status', width: 120, render: (r) => <StatusTag status={r.status} /> },
    {
      key: 'health',
      header: 'Health',
      width: 120,
      // The platform populates phase/health on a listing only while an app is
      // live or deploying, so an em dash here means "not reported", not "sick".
      render: (r) => (r.health ? <StatusTag status={r.health} /> : <Text fontSize="$3" color="$color10">—</Text>),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      width: 190,
      render: (r) => (
        <Text fontSize="$3" color="$color11" numberOfLines={1}>
          {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}
        </Text>
      ),
    },
  ]

  if (board.error) return <PlatformStateCard error={board.error} onRetry={() => void board.reload()} />

  return (
    <YStack gap="$3.5" data-testid={only ? `deploy-panel-${only}s` : 'deploy-board'}>
      {only ? null : (
        <XStack gap="$3" flexWrap="wrap">
          <MetricCard
            icon={<Rocket size={15} color="$color10" />}
            label="Deployments"
            value={count(totals.total, missingApps || missingSites)}
          />
          <MetricCard
            icon={<Layers size={15} color="$color10" />}
            label="Live"
            value={count(totals.live, missingApps || missingSites)}
          />
          <MetricCard
            icon={<AppWindow size={15} color="$color10" />}
            label="Apps"
            value={count(totals.apps, missingApps)}
          />
          <MetricCard
            icon={<Globe size={15} color="$color10" />}
            label="Sites"
            value={count(totals.sites, missingSites)}
          />
        </XStack>
      )}

      {note ? (
        <Text fontSize="$2" color="$color11" role="status">
          {note}
        </Text>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        loading={board.loading}
        rowKey={(r) => `${r.kind}:${r.project ?? ''}:${r.slug}`}
        onRowPress={(r) =>
          router.push(r.kind === 'app' ? `/app-platform/${encodeURIComponent(r.slug)}` : `/platform/${encodeURIComponent(r.slug)}`)
        }
        empty="Nothing deployed yet — start with New deployment."
      />
    </YStack>
  )
}
