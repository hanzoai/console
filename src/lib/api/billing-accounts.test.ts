import { describe, it, expect, afterEach, vi } from 'vitest'

import { BillingAccountApi, normalizeAccounts, normalizeChain } from './billing-accounts'

/** The PAGE origin — where the console is served from. */
const ORIGIN = 'https://console.hanzo.ai'
/** The API host — where it calls, whatever origin it was served from. */
const API = 'https://api.hanzo.ai'

/** A captured request (url + init) for asserting the exact call the client made. */
type Captured = { url: string; init: RequestInit }

/** Stub `window` + a `fetch` that RECORDS every request and replies with `body`. */
function captureFetch(body: unknown, status = 200): Captured[] {
  ;(globalThis as { window?: unknown }).window = {
    location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  }
  const calls: Captured[] = []
  const nullBody = status === 204 || status === 205 || status === 304
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init })
    return Promise.resolve(
      new Response(nullBody ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    )
  })
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete (globalThis as { window?: unknown }).window
})

const bodyOf = (c: Captured): Record<string, unknown> => JSON.parse(String(c.init.body)) as Record<string, unknown>

/**
 * A chain as commerce returns it — the account charged FIRST, first.
 *
 * Deliberately NOT in priority order: the project override leads with priority 5
 * while the anchor sits at 0. That is what "project SHADOWS org" looks like on the
 * wire when holder-rank outranks priority — and pinning it here is the whole point,
 * because the ordering RULE lives in commerce and is still moving (rank-primary vs
 * the merged priority sort). A fixture that happened to be priority-ascending would
 * make these tests pass against a client that re-sorted, proving nothing.
 */
const CHAIN = [
  { accountId: 'acct_proj', source: 'project', holderId: 'apollo', priority: 5, bindingId: 'bnd_p' },
  { accountId: 'acct_anchor', source: 'anchor', holderId: 'maxpower', priority: 0 },
  { accountId: 'acct_org', source: 'org', holderId: 'maxpower', priority: 1, bindingId: 'bnd_o' },
]

describe('chain — the ORDER is commerce’s answer, rendered as returned', () => {
  it('PRESERVES commerce’s order verbatim, even against the priority numbers', async () => {
    // The page renders `chain.map(...)`, so this IS the render order. Commerce
    // resolves the payer and is the one source of truth for who pays; re-sorting
    // locally would be a second, divergent answer — and would start lying the moment
    // commerce's ordering rule changes. A priority sort would yield
    // [anchor(0), org(1), proj(5)] — the opposite of what commerce said.
    captureFetch({ chain: CHAIN })
    const chain = await BillingAccountApi.chain()
    expect(chain.map((l) => l.accountId)).toEqual(['acct_proj', 'acct_anchor', 'acct_org'])
  })

  it('keeps a HIGHER-priority link ABOVE a lower one when commerce ordered it that way', async () => {
    // acct_proj (priority 5) leads acct_anchor (priority 0): the project override
    // shadows the org default. Only the wire order can express that.
    captureFetch({ chain: CHAIN })
    const chain = await BillingAccountApi.chain()
    const i = chain.findIndex((l) => l.accountId === 'acct_proj')
    const j = chain.findIndex((l) => l.accountId === 'acct_anchor')
    expect(i).toBeLessThan(j)
    expect(chain[i].priority).toBeGreaterThan(chain[j].priority) // order ≠ priority order
  })

  it('carries WHY each link is there (source + holder + priority + binding row)', async () => {
    captureFetch({ chain: CHAIN })
    const [first, second] = await BillingAccountApi.chain()
    expect(first).toMatchObject({ accountId: 'acct_proj', source: 'project', holderId: 'apollo', priority: 5, bindingId: 'bnd_p' })
    // The anchor is DERIVED: no binding row, so the page cannot offer to detach it.
    expect(second.source).toBe('anchor')
    expect(second.bindingId).toBeUndefined()
  })

  it('scopes the read to a project when one is selected, else org-level', async () => {
    const c1 = captureFetch({ chain: [] })
    await BillingAccountApi.chain('apollo')
    expect(c1[0].url).toContain('/v1/billing/chain?project=apollo')

    vi.unstubAllGlobals()
    const c2 = captureFetch({ chain: [] })
    await BillingAccountApi.chain()
    expect(c2[0].url).toContain('/v1/billing/chain')
    expect(c2[0].url).not.toContain('project=')
  })

  it('degrades HONESTLY when the money-graph endpoint is not served (no fabricated chain)', async () => {
    captureFetch({ error: 'not found' }, 404)
    await expect(BillingAccountApi.chain()).rejects.toThrow()
  })

  it('treats an unknown holder class as the anchor rather than inventing one', () => {
    expect(normalizeChain({ chain: [{ accountId: 'a', source: 'wat' }] })[0].source).toBe('anchor')
  })

  it('drops a link with no account id (never a phantom row)', () => {
    expect(normalizeChain({ chain: [{ source: 'org' }, { accountId: 'a', source: 'org' }] })).toHaveLength(1)
  })
})

describe('accounts', () => {
  it('normalizes commerce’s rows and drops any without an id', () => {
    const out = normalizeAccounts({ accounts: [{ id: 'acct_1', name: 'Ops', currency: 'usd' }, { name: 'nameless' }] })
    expect(out).toEqual([{ id: 'acct_1', displayName: 'Ops', currency: 'usd', provider: undefined }])
  })

  it('accepts a bare array as well as an enveloped payload', () => {
    expect(normalizeAccounts([{ id: 'acct_1' }])).toHaveLength(1)
  })
})

/**
 * The client half of the holder pin. Whose chain an account attaches to is a PAYER
 * decision, so the browser must not be able to name it: it sends a holder KIND, and
 * the `/billing` proxy derives `holderId` from the session
 * (lib/server/billing-scope `holderIdFor`). A client that sent `holderId` would be
 * handing the proxy a value to trust.
 */
describe('bind — the browser names a KIND, never a holder id', () => {
  it('sends holderKind + accountId + priority and NO holderId (org scope)', async () => {
    const calls = captureFetch({}, 200)
    await BillingAccountApi.bind({ holderKind: 'org' }, 'acct_x', 2)
    const b = bodyOf(calls[0])
    expect(b.holderKind).toBe('org')
    expect(b.accountId).toBe('acct_x')
    expect(b.priority).toBe(2)
    expect('holderId' in b).toBe(false) // the server says WHICH holder — not us
  })

  it('names the project for a project scope, still without a holder id', async () => {
    const calls = captureFetch({}, 200)
    await BillingAccountApi.bind({ holderKind: 'project', project: 'apollo' }, 'acct_x', -1)
    const b = bodyOf(calls[0])
    expect(b).toMatchObject({ holderKind: 'project', project: 'apollo', accountId: 'acct_x', priority: -1 })
    expect('holderId' in b).toBe(false)
  })

  it('POSTs to the per-tenant billing proxy (the /v1-first filesystem route)', async () => {
    const calls = captureFetch({}, 200)
    await BillingAccountApi.bind({ holderKind: 'org' }, 'acct_x', 0)
    expect(calls[0].url).toBe(`${API}/v1/billing/bindings`)
    expect(calls[0].init.method).toBe('POST')
  })

  it('a re-bind is the SAME call as an attach (reorder has no second verb)', async () => {
    // The binding id is deterministic in (holderKind, holderId, accountId), so
    // re-asserting a pair at a new priority updates that one row.
    const calls = captureFetch({}, 200)
    await BillingAccountApi.bind({ holderKind: 'org' }, 'acct_x', 0)
    await BillingAccountApi.bind({ holderKind: 'org' }, 'acct_x', 5)
    expect(calls.map((c) => c.init.method)).toEqual(['POST', 'POST'])
    expect(calls.map((c) => c.url)).toEqual([`${API}/v1/billing/bindings`, `${API}/v1/billing/bindings`])
    expect(bodyOf(calls[1]).priority).toBe(5)
  })
})

describe('unbind', () => {
  it('DELETEs the binding row by id (encoded)', async () => {
    const calls = captureFetch(null, 204)
    await BillingAccountApi.unbind('bnd_abc')
    expect(calls[0].init.method).toBe('DELETE')
    expect(calls[0].url).toBe(`${API}/v1/billing/bindings/bnd_abc`)
  })
})
