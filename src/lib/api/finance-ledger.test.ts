import { describe, it, expect } from 'vitest'

import { financeUrl, unwrapEnvelope } from './finance-ledger'

/**
 * The console finance transport addresses `/v1/finance/*` on the canonical API host and
 * unwraps a casibase envelope. The data contract + normalizers live in the SHARED
 * `@hanzo/finance-ui` package (tested there), so these pin only console's transport wiring.
 */
/** The API host — named in config, so the URL never depends on the caller's origin. */
const API = 'https://api.hanzo.ai'

// There is no `window` in this file — no stub, none needed. That is the point: the
// address is fully qualified whether it is built in the browser or on the server. It
// used to degrade to a root-relative `/v1/finance/*` under SSR, which no server-side
// fetch can resolve.
describe('financeUrl — the canonical /v1/finance address (window-independent)', () => {
  it('builds the /v1/finance/<head> URL', () => {
    expect(financeUrl('balance')).toBe(`${API}/v1/finance/balance`)
    expect(financeUrl('payment-methods')).toBe(`${API}/v1/finance/payment-methods`)
  })
  it('appends a query, skipping undefined values', () => {
    expect(financeUrl('usage', { range: '7d' })).toBe(`${API}/v1/finance/usage?range=7d`)
    expect(financeUrl('ledger', { range: undefined })).toBe(`${API}/v1/finance/ledger`)
  })
})

describe('unwrapEnvelope', () => {
  it('unwraps a casibase { status, msg, data } envelope', () => {
    expect(unwrapEnvelope({ status: 'ok', msg: '', data: { availableCents: 500 } })).toEqual({ availableCents: 500 })
  })
  it('passes a bare payload through', () => {
    expect(unwrapEnvelope([{ id: 'a' }])).toEqual([{ id: 'a' }])
    expect(unwrapEnvelope({ availableCents: 5 })).toEqual({ availableCents: 5 })
  })
})
