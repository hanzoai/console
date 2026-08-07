// Embed-mode API path contract. In the go:embed console (IS_EMBED) there is NO Next
// server, so the service-token BFF route handlers (app/v1/billing, app/v1/commerce,
// /keys) are stripped by the static export and a request to them falls through to the
// SPA shell (HTML). The cloud binary serves the SAME heads at the CANONICAL bare /v1/* on
// the same origin (caller resolved from the first-party IAM session cookie → validated
// principal), so in embed mode those builders must resolve to bare /v1/*. This pins it;
// the non-embed contract stays in canonical-paths.test.ts. (cloudProxyV1Url already
// equals originV1Url on main, so the cloud-head BFF is bare /v1 in every deployment.)
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Force embed mode BEFORE importing the builders (IS_EMBED is read at module load).
vi.mock('~/lib/embed', () => ({ IS_EMBED: true }))

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''

describe('embed-mode API paths (IS_EMBED)', () => {
  beforeEach(() => vi.resetModules())

  it('billing proxy → bare /v1/billing/<path> (the /v1-first billing path)', async () => {
    const { billingProxyV1Url } = await import('./client')
    expect(billingProxyV1Url('balance')).toBe(`${ORIGIN}/v1/billing/balance`)
    expect(billingProxyV1Url('usage')).toBe(`${ORIGIN}/v1/billing/usage`)
    expect(billingProxyV1Url('invoices')).toBe(`${ORIGIN}/v1/billing/invoices`)
  })

  it('commerce proxy → bare /v1/commerce/<path>', async () => {
    const { commerceProxyV1Url } = await import('./client')
    expect(commerceProxyV1Url('product')).toBe(`${ORIGIN}/v1/commerce/product`)
    expect(commerceProxyV1Url('store/current')).toBe(`${ORIGIN}/v1/commerce/store/current`)
  })

  it('cloud-head BFF is bare /v1 (main collapsed cloudProxyV1Url → originV1Url)', async () => {
    const { cloudProxyV1Url } = await import('./client')
    expect(cloudProxyV1Url('s3/buckets')).toBe(`${ORIGIN}/v1/s3/buckets`)
    expect(cloudProxyV1Url('framework/doctypes')).not.toContain('/cloud/')
  })
})
