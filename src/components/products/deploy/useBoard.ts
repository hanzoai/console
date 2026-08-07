'use client'

/**
 * The deploy board's ONE read: the org's container apps and its static sites,
 * folded into a single `DeployRow` list.
 *
 * Two independent backends answer here (`/v1/platform/projects/:p/apps` and
 * `/v1/platform/sites`), so they are read with `allSettled` and reported
 * separately. A partial read stays a partial read: the rows that loaded render,
 * and `incomplete` names the source that did not, so a caller can say which
 * number on the screen is now a lie. Collapsing that into one error would hide
 * working data; collapsing it into silence would show a short list as if it were
 * the whole truth. Only when BOTH fail is there nothing honest to draw, and then
 * `error` carries the state card.
 *
 * The apps fan-out is done HERE rather than through `PaasApi.listAllApps`, which
 * swallows a per-project failure with `.catch(() => [])`. That is a fine default
 * for a board that only wants rows, but it makes "you have 3 apps" indistinguishable
 * from "you have 3 apps that we could see", and this board's whole job is to say
 * which of the two it is showing.
 *
 * Org scoping is the bearer proxy's job on the server side. This hook sends no
 * org and filters by none.
 */
import { useCallback, useEffect, useState } from 'react'

import { PaasApi } from '~/lib/api/paas'
import { PlatformSitesApi } from '~/lib/api/platform-sites'
import { byRecency, rowOfApp, rowOfSite, type DeployKind, type DeployRow } from '~/lib/deploy/board'
import { interpretPlatformError, type PlatformError } from '../platform/state'

export type Board = {
  rows: DeployRow[]
  loading: boolean
  /** Set only when BOTH sources failed — there is nothing truthful to render. */
  error: PlatformError | null
  /** Sources whose rows are missing or partial. Empty when the board is whole. */
  incomplete: DeployKind[]
  reload: () => Promise<void>
}

/** Rows for every project the org owns, and whether every project answered. */
async function readApps(): Promise<{ rows: DeployRow[]; whole: boolean }> {
  // A failure HERE is total — no project list means no apps at all — so it
  // propagates and the caller marks the whole source missing.
  const projects = await PaasApi.listProjects()
  const settled = await Promise.allSettled(
    projects.map((project) =>
      PaasApi.listApps(project.slug || project.id).then((apps) => apps.map((app) => rowOfApp({ ...app, project }))),
    ),
  )
  return {
    rows: settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : [])),
    whole: settled.every((s) => s.status === 'fulfilled'),
  }
}

export function useBoard(): Board {
  const [rows, setRows] = useState<DeployRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PlatformError | null>(null)
  const [incomplete, setIncomplete] = useState<DeployKind[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [apps, sites] = await Promise.allSettled([readApps(), PlatformSitesApi.list()])

    const next: DeployRow[] = []
    if (apps.status === 'fulfilled') next.push(...apps.value.rows)
    if (sites.status === 'fulfilled') next.push(...sites.value.map(rowOfSite))
    setRows(byRecency(next))

    if (apps.status === 'rejected' && sites.status === 'rejected') {
      setError(interpretPlatformError(apps.reason))
      setIncomplete([])
      setLoading(false)
      return
    }

    setError(null)
    setIncomplete([
      // Rejected = the source is missing entirely; fulfilled-but-not-whole = some
      // projects answered and some did not. Both make the app counts a floor.
      ...(apps.status === 'rejected' || !apps.value.whole ? (['app'] as const) : []),
      ...(sites.status === 'rejected' ? (['site'] as const) : []),
    ])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { rows, loading, error, incomplete, reload: load }
}
