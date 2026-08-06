// Embed-mode API path contract. In the go:embed console (IS_EMBED) there is NO Next
// server, so the service-token BFF route handlers (app/v1/billing, app/v1/commerce,
// /keys) are stripped by the static export and a request to them would fall through to
// the SPA shell (HTML). The cloud binary serves the SAME heads at the CANONICAL bare
// /v1/*, so in embed mode those builders must resolve to a bare /v1/<head>/<path> —
// no proxy namespace before /v1, nothing that needs a Next route handler to exist.
//
// The host is NAMED (api.hanzo.ai) rather than inherited from the page origin. That is
// the deliberate contract change: the embed console used to be correct only BECAUSE it
// was same-origin with the cloud binary, and a path that misses on that origin lands in
// the SPA catch-all and answers 200 text/html — a request that reached no backend but
// looks like a backend error. Naming the host removes that whole failure mode; nothing
// on api.hanzo.ai can be shadowed by a client-side route. This pins the head shape AND
// the host; the non-embed contract stays in canonical-paths.test.ts. (cloudProxyV1Url
// already equals originV1Url on main, so the cloud-head BFF is bare /v1 everywhere.)
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Force embed mode BEFORE importing the builders (IS_EMBED is read at module load).
vi.mock('~/lib/embed', () => ({ IS_EMBED: true }))

/** The API host — named, so the embed build addresses it from any served origin. */
const API = 'https://api.hanzo.ai'

describe('embed-mode API paths (IS_EMBED)', () => {
  beforeEach(() => vi.resetModules())

  it('billing proxy → bare /v1/billing/<path> (the /v1-first billing path)', async () => {
    const { billingProxyV1Url } = await import('./client')
    expect(billingProxyV1Url('balance')).toBe(`${API}/v1/billing/balance`)
    expect(billingProxyV1Url('usage')).toBe(`${API}/v1/billing/usage`)
    expect(billingProxyV1Url('invoices')).toBe(`${API}/v1/billing/invoices`)
  })

  it('commerce proxy → bare /v1/commerce/<path>', async () => {
    const { commerceProxyV1Url } = await import('./client')
    expect(commerceProxyV1Url('product')).toBe(`${API}/v1/commerce/product`)
    expect(commerceProxyV1Url('store/current')).toBe(`${API}/v1/commerce/store/current`)
  })

  it('cloud-head BFF is bare /v1 (main collapsed cloudProxyV1Url → originV1Url)', async () => {
    const { cloudProxyV1Url } = await import('./client')
    expect(cloudProxyV1Url('s3/buckets')).toBe(`${API}/v1/s3/buckets`)
    expect(cloudProxyV1Url('framework/doctypes')).not.toContain('/cloud/')
  })
})
