import { describe, it, expect } from 'vitest'

import { financeUrl, unwrapEnvelope } from './finance-ledger'

/**
 * The console finance transport addresses the `/v1` user-bearer proxy (never a bare
 * `/v1/finance/*`, which 403s cookie-only on the live ingress) and unwraps a casibase
 * envelope. The data contract + normalizers live in the SHARED `@hanzo/finance-ui`
 * package (tested there), so these pin only console's transport wiring.
 */
describe('financeUrl — /v1 bearer BFF address (SSR, no window)', () => {
  it('builds the /v1/finance/<head> proxy URL', () => {
    expect(financeUrl('balance')).toBe('/v1/finance/balance')
    expect(financeUrl('payment-methods')).toBe('/v1/finance/payment-methods')
  })
  it('appends a query, skipping undefined values', () => {
    expect(financeUrl('usage', { range: '7d' })).toBe('/v1/finance/usage?range=7d')
    expect(financeUrl('ledger', { range: undefined })).toBe('/v1/finance/ledger')
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
