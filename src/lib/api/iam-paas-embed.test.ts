import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Embed-topology transport for the OrgSwitcher (IAM admin) and Observe→Status (PaaS).
 *
 * REGRESSION GUARD for the console.hanzo.ai / cloud.hanzo.ai (go:embed) outage: the
 * static export prunes every Next server route, and the cloud binary serves the SPA
 * index (HTTP 200 HTML) for any NON-`/v1/` path. The OrgSwitcher hit `/admin/iam/*`
 * and Status hit `/paas/*` — both non-`/v1/`, so they parsed the SPA and errored
 * ("Invalid response from server (HTTP 200)" → empty switcher / "Could not reach the
 * platform"). In the embed these MUST address cloud-native `/v1/iam/*` and
 * `/v1/paas/*` (which the cloud binary serves) with the bearer.
 *
 * IS_EMBED is captured at module load, so it is mocked BEFORE importing the clients.
 */
vi.mock('~/lib/embed', () => ({ IS_EMBED: true }))

const ORIGIN = 'https://console.hanzo.ai'

describe('go:embed IAM-admin + PaaS address cloud-native /v1/* (not the pruned BFF prefixes)', () => {
  const fetched: { url: string; method: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url: String(url), method: init?.method ?? 'GET' })
      const path = String(url)
      // IAM speaks the {status,msg,data,data2} envelope; PaaS speaks plain REST JSON.
      const body = path.includes('/v1/iam/')
        ? JSON.stringify({ status: 'ok', msg: '', data: [], data2: 0 })
        : JSON.stringify({ apps: [] })
      return Promise.resolve(
        new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('OrgSwitcher org list → GET <origin>/v1/iam/get-organizations (was /admin/iam → SPA 200)', async () => {
    const { IamAdminApi } = await import('./admin')
    await IamAdminApi.organizations()
    expect(fetched).toHaveLength(1)
    expect(fetched[0].method).toBe('GET')
    expect(fetched[0].url.startsWith(`${ORIGIN}/v1/iam/get-organizations`)).toBe(true)
    // The cross-tenant list stays scoped to the reserved admin org (super-admin gate upstream).
    expect(fetched[0].url).toContain('owner=admin')
    // NEVER the pruned BFF prefix that fell through to the SPA index in the embed.
    expect(fetched[0].url).not.toContain('/admin/iam/')
  })

  it('Observe→Status apps inventory → GET <origin>/v1/paas/apps (was /paas/apps → SPA 200)', async () => {
    const { PlatformApi } = await import('./platform')
    await PlatformApi.apps()
    expect(fetched).toHaveLength(1)
    expect(fetched[0].method).toBe('GET')
    expect(fetched[0].url).toBe(`${ORIGIN}/v1/paas/apps`)
  })

  it('an IAM-admin mutation also rides the cloud-native /v1/iam surface', async () => {
    const { IamAdminApi } = await import('./admin')
    await IamAdminApi.approveUser('hanzo/u-1')
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].url.startsWith(`${ORIGIN}/v1/iam/approve-user`)).toBe(true)
    expect(fetched[0].url).not.toContain('/admin/iam/')
  })
})
