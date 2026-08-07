import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { get } from './client'
import { setScope } from '~/lib/scope'
import { setCurrentActor } from '~/lib/actor-scope'
import { setCurrentOrg } from '~/lib/org-scope'
import { VisorApi } from './visor'
import { ComputeApi } from './compute'
import { ProvisioningApi } from './provisioning'
import { StorageApi } from './storage'
import { FrameworkApi } from '~/lib/framework/client'
import { BillingApi } from './billing'
import { PlansApi } from './plans'
import { PlatformApi } from './platform'
import { fetchPlans } from './aicatalog'
import { ApmApi } from './apm'
import { CommerceApi } from './commerce'
import { StoreApi } from './stores'
import { EmbeddingsApi } from './embeddings'
import { FunctionsApi } from './functions'
import { PaasApi } from './paas'
import { CompanyApi } from './company'
import { CapTableApi } from './captable'

const ORIGIN = 'https://console.hanzo.ai'

let lastUrl = ''
let lastInit: RequestInit | undefined

/** Stub window (Map-backed localStorage) + a single JSON fetch; capture url + init. */
function stub(body: unknown, status = 200): void {
  lastUrl = ''
  lastInit = undefined
  const store = new Map<string, string>()
  ;(globalThis as { window?: unknown }).window = {
    location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, val: string) => void store.set(k, val),
      removeItem: (k: string) => void store.delete(k),
    },
  }
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    lastUrl = String(url)
    lastInit = init
    return Promise.resolve(
      new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    )
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete (globalThis as { window?: unknown }).window
})

// CTO contract: EVERY cloud API path is `/v1/`-rooted with ZERO prefix (no `/cloud/`,
// no `/api/`). The bearer-scoped cloud heads — gpus/clusters (compute), functions,
// platform (paas), s3, framework, provisioning (sql/vector/kv/datastore/docdb/search),
// the casibase STORE-ADMIN heads (get-stores/…), and machines — all authorize on the
// Bearer owner claim and reject a cookie-only browser call ("X-Org-Id required" /
// "valid principal required" / a FALSE "session expired"). So the browser calls the
// canonical, prefix-free `<origin>/v1/<head>`, which terminates at the console's OWN
// `app/v1/[...path]` bearer BFF: it mints a short-lived user token from the session and
// forwards to cloud-api `/v1/*` with the org resolved from the token owner. This block
// PINS the prefix-free contract so a regression can't re-introduce a `/cloud/` prefix.
describe('cloud heads → the same-origin /v1 bearer BFF (prefix-free, ZERO /cloud)', () => {
  it('ComputeApi.gpus (inventory) -> /v1/gpus', async () => {
    stub({ gpus: [] })
    await ComputeApi.gpus()
    expect(lastUrl).toBe(`${ORIGIN}/v1/gpus`)
  })
  it('PlatformApi.listClusters -> /v1/clusters', async () => {
    stub({ clusters: [] })
    await PlatformApi.listClusters()
    expect(lastUrl).toBe(`${ORIGIN}/v1/clusters`)
  })
  it('FunctionsApi.list -> /v1/functions', async () => {
    stub({ functions: [] })
    await FunctionsApi.list()
    expect(lastUrl).toBe(`${ORIGIN}/v1/functions`)
  })
  it('PaasApi.listProjects -> /v1/platform/projects', async () => {
    stub({ projects: [] })
    await PaasApi.listProjects()
    expect(lastUrl).toBe(`${ORIGIN}/v1/platform/projects`)
  })
  it('StorageApi.buckets -> /v1/s3/buckets', async () => {
    stub({ buckets: [] })
    await StorageApi.buckets()
    expect(lastUrl).toBe(`${ORIGIN}/v1/s3/buckets`)
  })
  it('FrameworkApi.doctypes.list -> /v1/framework/doctypes', async () => {
    stub({ data: [] })
    await FrameworkApi.doctypes.list()
    expect(lastUrl).toBe(`${ORIGIN}/v1/framework/doctypes`)
  })
  it('ProvisioningApi.list(vector) -> /v1/vector', async () => {
    stub([])
    await ProvisioningApi.list('vector')
    expect(lastUrl).toBe(`${ORIGIN}/v1/vector`)
  })
  it('ProvisioningApi.list(sql) -> /v1/sql', async () => {
    stub([])
    await ProvisioningApi.list('sql')
    expect(lastUrl).toBe(`${ORIGIN}/v1/sql`)
  })
  it('StoreApi.list (embeddings collections) -> /v1/ai/stores', async () => {
    stub({ status: 'ok', msg: '', data: [] })
    await StoreApi.list('acme')
    expect(lastUrl).toBe(`${ORIGIN}/v1/ai/stores?owner=acme`)
  })
  it('StoreApi.get -> the member URL, owner and name as SEPARATE segments', async () => {
    stub({ status: 'ok', msg: '', data: {} })
    await StoreApi.get('acme', 'my store')
    // Not `?id=acme/my store`, and not ONE percent-encoded segment: the server
    // decodes %2F back into a separator before routing, so a composite id in a
    // single segment would never match its route.
    expect(lastUrl).toBe(`${ORIGIN}/v1/ai/stores/acme/my%20store`)
  })
  it('VisorApi.machines -> /v1/machines (bearer-scoped)', async () => {
    stub({ machines: [] })
    await VisorApi.machines()
    expect(lastUrl).toBe(`${ORIGIN}/v1/machines`)
  })
  it('CompanyApi.get -> /v1/company (formation state machine)', async () => {
    stub({ formation: { org: 'acme', stage: 'structure' }, nextStages: [] })
    await CompanyApi.get()
    expect(lastUrl).toBe(`${ORIGIN}/v1/company`)
  })
  it('CapTableApi.summary -> /v1/captable/summary (computed cap table)', async () => {
    stub({ company: { id: 'acme', name: 'Acme' }, totals: {}, byStakeholder: [], byShareClass: [] })
    await CapTableApi.summary()
    expect(lastUrl).toBe(`${ORIGIN}/v1/captable/summary`)
  })
  it('CapTableApi.stakeholders.list -> /v1/captable/stakeholders', async () => {
    stub([])
    await CapTableApi.stakeholders.list()
    expect(lastUrl).toBe(`${ORIGIN}/v1/captable/stakeholders`)
  })
  it('none of the cloud heads emits a /<svc>/v1/ prefix', async () => {
    const bad = /\/(cloud|vm|ai|billing|org|commerce)\/v1\//
    stub({ gpus: [] })
    await ComputeApi.gpus()
    expect(lastUrl).not.toMatch(bad)
    stub({ buckets: [] })
    await StorageApi.buckets()
    expect(lastUrl).not.toMatch(bad)
    stub({ machines: [] })
    await VisorApi.machines()
    expect(lastUrl).not.toMatch(bad)
  })
  // o11y is IAM-gated (403 "no validated principal" for a bearer-less call) and the
  // canonical surface is VERSION-LESS (`/v1/o11y/<resource>`, NO nested v1/v3, NO /api),
  // so the ApmApi client rides the same-origin `/v1` bearer BFF like the rest — a
  // logged-in session's minted bearer passes, and the path carries no nested version.
  it('ApmApi.dashboards -> /v1/o11y/dashboards (version-less, /v1 bearer BFF — NOT /cloud, NOT nested /v1/o11y/v1/...)', async () => {
    stub([])
    await ApmApi.dashboards()
    expect(lastUrl).toBe(`${ORIGIN}/v1/o11y/dashboards`)
  })
})

// baseHeaders stamps the FULL tenant path on every call: org (always), project
// (when selected), and the signed-in actor (when a session is resolved).
describe('baseHeaders — org + project + actor on every call', () => {
  beforeEach(() => {
    stub({ status: 'ok', msg: '', data: {} })
  })

  it('stamps X-Org-Id + X-Project-Id + X-Actor-Id', async () => {
    setCurrentOrg('maxpower')
    setScope({ project: 'proj-1', environment: 'mainnet' })
    setCurrentActor('hanzo/z')
    await get('anything')
    const h = (lastInit?.headers ?? {}) as Record<string, string>
    expect(h['X-Org-Id']).toBe('maxpower')
    expect(h['X-Project-Id']).toBe('proj-1')
    expect(h['X-Actor-Id']).toBe('hanzo/z')
  })

  it('omits X-Project-Id + X-Actor-Id when neither project nor actor is set', async () => {
    setScope({ project: undefined, environment: 'mainnet' })
    setCurrentActor('')
    await get('anything')
    const h = (lastInit?.headers ?? {}) as Record<string, string>
    expect(h['X-Project-Id']).toBeUndefined()
    expect(h['X-Actor-Id']).toBeUndefined()
    expect(h['X-Org-Id']).toBeTruthy()
  })
})

// The genuinely SESSION-scoped data-product clients build the CANONICAL, prefix-free
// `/v1/<resource>` through `originV1Url`. plans/embeddings (AI gateway) are served on
// the session path (the gateway forwards the session and cloud resolves the org from
// the session owner), so a bare `/v1/*` works — VERIFIED LIVE.
// (functions + paas + apm/o11y are pinned in the /v1 bearer BFF block above — they are
// header/IAM-scoped and 403 on the bare path. o11y is additionally VERSION-LESS.)
describe('canonical /v1 — session-scoped data-product clients (no prefix before /v1/)', () => {
  it('aicatalog fetchPlans -> /v1/plans (AI catalog head -> /ai)', async () => {
    stub({ plans: [] })
    await fetchPlans()
    expect(lastUrl).toBe(`${ORIGIN}/v1/plans`)
  })
  it('embeddings EmbeddingsApi.generate -> /v1/embeddings (AI head -> /ai)', async () => {
    stub({})
    await EmbeddingsApi.generate('text-embedding-3-small', 'hi')
    expect(lastUrl).toBe(`${ORIGIN}/v1/embeddings`)
  })
  // Functions + PaaS + apm/o11y are NOT bare session clients — they ride the /v1 bearer
  // BFF (pinned in the "cloud heads → the same-origin /v1 bearer BFF" block above) and
  // 403 on a cookie-only call. Commerce is NOT a bare-/v1/ client either — it addresses
  // the `/commerce` proxy EXPLICITLY (pinned in the proxy-exceptions block below). The
  // live ingress does not rewrite their heads.

  it('the (bare-/v1/) session-path clients emit no /<svc>/v1/ prefix', async () => {
    const bad = /\/(cloud|vm|ai|billing|org|commerce)\/v1\//
    stub({ plans: [] })
    await fetchPlans()
    expect(lastUrl).not.toMatch(bad)
    stub({})
    await EmbeddingsApi.generate('m', 'x')
    expect(lastUrl).not.toMatch(bad)
  })
})

// Money + store + visor-catalog DATA proxies are ALL /v1-first (the /v1-first law): billing
// + PlansApi (money-truth) ride `/v1/billing/*` (service-token proxy → `app/v1/billing/
// [...path]`); the store/merchant admin rides `/v1/commerce/*` (→ `app/v1/commerce/[...path]`);
// the visor compute CATALOG (regions/sizes/accelerators) rides `/v1/vm/*` (→ `app/v1/vm/
// [...path]`). Each is a FILESYSTEM route MORE SPECIFIC than the `/v1/[...path]` cloud BFF,
// so it wins without a rewrite. Visor is a DIFFERENT backend — its `/v1/vm/gpus` catalog is
// DISTINCT from the cloud GPU INVENTORY at `/v1/gpus`; this block PINS each at its own proxy
// so a regression can't repoint one at a cloud-api `/v1/<head>` that would 404 (wrong backend).
describe('money + store + visor-catalog proxies (all /v1-first): /v1/billing, /v1/commerce, /v1/vm', () => {
  it('BillingApi.balance -> /v1/billing/balance', async () => {
    stub({ balance: 0, holds: 0, available: 0 })
    await BillingApi.balance()
    expect(lastUrl).toBe(`${ORIGIN}/v1/billing/balance?currency=usd`)
  })

  it('PlansApi.plans -> /v1/billing/plans (money-truth catalog)', async () => {
    stub([])
    await PlansApi.plans()
    expect(lastUrl).toBe(`${ORIGIN}/v1/billing/plans`)
  })

  it('CommerceApi.currentStore -> /v1/commerce/store/current', async () => {
    stub({ store: {} })
    await CommerceApi.currentStore()
    expect(lastUrl).toBe(`${ORIGIN}/v1/commerce/store/current`)
  })

  it('VisorApi.gpus (accelerator CATALOG) -> /v1/vm/gpus (visor, NOT cloud-api /v1/gpu-sizes)', async () => {
    stub({ data: [] })
    await VisorApi.gpus()
    expect(lastUrl).toBe(`${ORIGIN}/v1/vm/gpus`)
  })
  it('VisorApi.regions -> /v1/vm/regions', async () => {
    stub({ data: [] })
    await VisorApi.regions()
    expect(lastUrl).toBe(`${ORIGIN}/v1/vm/regions`)
  })
  it('VisorApi.sizes -> /v1/vm/sizes', async () => {
    stub({ data: [] })
    await VisorApi.sizes()
    expect(lastUrl).toBe(`${ORIGIN}/v1/vm/sizes`)
  })
})
