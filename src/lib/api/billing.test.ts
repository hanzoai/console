import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { BillingApi, type PaymentMethod, type Subscription } from './billing'

const ORIGIN = 'https://console.hanzo.ai'

/** Stub `window` + a single JSON `fetch` response, shared by the read-only suites. */
function stubJson(body: unknown, status = 200): void {
  ;(globalThis as { window?: unknown }).window = {
    location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  }
  vi.stubGlobal('fetch', () =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })),
  )
}

function teardown(): void {
  vi.unstubAllGlobals()
  delete (globalThis as { window?: unknown }).window
}

/** A captured request (url + init) for asserting the exact call the client made. */
type Captured = { url: string; init: RequestInit }

/**
 * Stub `window` + a `fetch` that RECORDS every request and replies with `body`. Used
 * by the mutation suites to assert the method / URL / body the client sent (esp. that
 * a card add carries ONLY the Square nonce — never a PAN).
 */
function captureFetch(body: unknown, status = 200): Captured[] {
  ;(globalThis as { window?: unknown }).window = {
    location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  }
  const calls: Captured[] = []
  // A no-content status (204/205/304) must carry a null body (undici rejects a body).
  const nullBody = status === 204 || status === 205 || status === 304
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init })
    return Promise.resolve(
      new Response(nullBody ? null : JSON.stringify(body), {
        status,
        headers: nullBody ? {} : { 'content-type': 'application/json' },
      }),
    )
  })
  return calls
}

/**
 * Regression: the Cost page's "Usage by product" must read the REAL commerce
 * api-usage ledger correctly — per-model rows from `metadata.model` (not a single
 * generic "Usage" row) and cost from `amount` cents (NOT amount×100, the old
 * dollars-vs-cents bug that turned $0.01 into $1.00). Driven through the same
 * `/billing/usage` per-tenant proxy the page uses.
 */

/** A real ledger record, exactly as `commerce billing.GetUsage` emits it. */
function rec(model: string, amountCents: number, totalTokens: number, transactionId: string) {
  return {
    transactionId,
    amount: amountCents,
    currency: 'usd',
    notes: `API usage: ${model} (${totalTokens} tokens)`,
    createdAt: '2026-06-24T04:42:19Z',
    metadata: { model, provider: 'do-ai', promptTokens: totalTokens - 1, completionTokens: 1, totalTokens, status: 'success', stream: false, requestId: 'r' },
  }
}

describe('BillingApi.usage — real ledger mapping (Cost page)', () => {
  beforeEach(() => {
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    }
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            user: 'maxpower',
            count: 3,
            usage: [rec('gpt-4o-mini', 1, 39, 'a'), rec('gpt-4o', 5, 200, 'b'), rec('gpt-4o-mini', 1, 41, 'c')],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('groups by real model name, never a generic "Usage" row', async () => {
    const usage = await BillingApi.usage()
    const labels = usage.lines.map((l) => l.label).sort()
    expect(labels).toEqual(['gpt-4o', 'gpt-4o-mini'])
    expect(labels).not.toContain('Usage')
  })

  it('counts requests per model and sums tokens', async () => {
    const usage = await BillingApi.usage()
    const mini = usage.lines.find((l) => l.label === 'gpt-4o-mini')!
    expect(mini.units).toBe(2) // two records
    expect(mini.tokens).toBe(80) // 39 + 41
  })

  it('keeps amount in CENTS — no ×100 dollars bug', async () => {
    const usage = await BillingApi.usage()
    // total amount = 1 + 5 + 1 = 7 cents = $0.07 (NOT 700 cents / $7.00).
    expect(usage.totalCents).toBe(7)
    const mini = usage.lines.find((l) => l.label === 'gpt-4o-mini')!
    expect(mini.cents).toBe(2) // 1 + 1 cents
  })

  it('is honest-empty for an org with no usage', async () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify({ user: 'maxpower', count: 0, usage: [] }), { status: 200, headers: { 'content-type': 'application/json' } })))
    const usage = await BillingApi.usage()
    expect(usage.lines).toEqual([])
    expect(usage.totalCents).toBe(0)
  })
})

/**
 * Subscriptions — read-only over the same per-tenant `/billing/*` proxy. Commerce
 * is a flat nested vendor shape, so the normalizer must reach the plan name + price from a flat
 * `plan`, a nested `plan.nickname`, or the first `items.data[].price`, and must
 * treat `current_period_end` as either a Unix epoch (seconds) or an ISO string.
 */
describe('BillingApi.subscriptions — nested commerce mapping', () => {
  afterEach(teardown)

  it('reads plan/status/quantity/price from a nested subscription', async () => {
    stubJson({
      subscriptions: [
        {
          id: 'sub_1',
          status: 'active',
          quantity: 5,
          current_period_end: 1893456000, // 2030-01-01 in epoch SECONDS
          plan: { nickname: 'Team', amount: 2000, interval: 'month' },
        },
      ],
    })
    const subs = await BillingApi.subscriptions()
    expect(subs).toHaveLength(1)
    const s: Subscription = subs[0]
    expect(s.id).toBe('sub_1')
    expect(s.plan).toBe('Team')
    expect(s.status).toBe('active')
    expect(s.quantity).toBe(5)
    expect(s.cents).toBe(2000)
    expect(s.interval).toBe('month')
    // epoch seconds → a real ISO date (not fabricated, not NaN).
    expect(s.currentPeriodEnd).toBe(new Date(1893456000 * 1000).toISOString())
  })

  it('falls back to items[].price for the plan name + unit_amount', async () => {
    stubJson({
      data: [
        {
          id: 'sub_2',
          status: 'trialing',
          items: { data: [{ quantity: 1, price: { nickname: 'Pro', unit_amount: 4900, recurring: { interval: 'year' } } }] },
        },
      ],
    })
    const [s] = await BillingApi.subscriptions()
    expect(s.plan).toBe('Pro')
    expect(s.cents).toBe(4900)
    expect(s.interval).toBe('year')
  })

  it('degrades an unnamed subscription to "—" and undefined price, never invents', async () => {
    stubJson({ subscriptions: [{ id: 'sub_3', status: 'past_due' }] })
    const [s] = await BillingApi.subscriptions()
    expect(s.plan).toBe('—')
    expect(s.cents).toBeUndefined()
    expect(s.currentPeriodEnd).toBeUndefined()
  })

  it('is honest-empty for an org with no subscriptions', async () => {
    stubJson({ subscriptions: [] })
    expect(await BillingApi.subscriptions()).toEqual([])
  })
})

/**
 * Payment methods — read-only + MASKED. The normalizer must surface ONLY the
 * non-sensitive descriptor (brand + last4 + expiry) commerce returns, from either
 * camelCase or snake_case, and must never produce a PAN/CVV/token (none is
 * present in the payload).
 */
describe('BillingApi.paymentMethods — masked descriptor mapping', () => {
  afterEach(teardown)

  it('reads brand/last4/expiry/default from a nested card (snake_case)', async () => {
    stubJson({
      payment_methods: [
        { id: 'pm_1', type: 'card', is_default: true, card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } },
      ],
    })
    const methods = await BillingApi.paymentMethods()
    expect(methods).toHaveLength(1)
    const m: PaymentMethod = methods[0]
    expect(m.brand).toBe('visa')
    expect(m.last4).toBe('4242')
    expect(m.expMonth).toBe(12)
    expect(m.expYear).toBe(2030)
    expect(m.isDefault).toBe(true)
  })

  it('reads a flat camelCase method shape', async () => {
    stubJson({ paymentMethods: [{ id: 'pm_2', brand: 'mastercard', last4: '5555', expMonth: 3, expYear: 2029, isDefault: false }] })
    const [m] = await BillingApi.paymentMethods()
    expect(m.brand).toBe('mastercard')
    expect(m.last4).toBe('5555')
    expect(m.isDefault).toBe(false)
  })

  it('NEVER exposes a full PAN / CVV / token — only last4 survives normalization', async () => {
    // A hostile/rich payload: even if a raw PAN, cvc, or token appears upstream,
    // the display shape carries ONLY the masked descriptor. Assert the leak fields
    // are absent from every normalized object.
    stubJson({
      data: [
        {
          id: 'pm_3',
          card: { brand: 'amex', last4: '0005', exp_month: 1, exp_year: 2031, number: '378282246310005', cvc: '1234' },
          token: 'tok_secret_should_never_surface',
        },
      ],
    })
    const [m] = await BillingApi.paymentMethods()
    expect(m.last4).toBe('0005')
    expect(m.brand).toBe('amex')
    const keys = Object.keys(m)
    for (const leak of ['number', 'pan', 'cvc', 'cvv', 'token', 'card']) {
      expect(keys).not.toContain(leak)
    }
    // And no value on the object equals the raw secret.
    for (const v of Object.values(m)) expect(v).not.toBe('378282246310005')
    for (const v of Object.values(m)) expect(v).not.toBe('tok_secret_should_never_surface')
  })

  it('clamps last4 to the last 4 digits even if commerce puts a full PAN there', async () => {
    // Defense-in-depth for a commerce-side bug: a full PAN (or a spaced/formatted
    // number) landing IN the last4 field must still surface at most four digits.
    stubJson({ paymentMethods: [{ id: 'pm_5', brand: 'visa', last4: '4111111111111111' }] })
    const [a] = await BillingApi.paymentMethods()
    expect(a.last4).toBe('1111')

    stubJson({ data: [{ id: 'pm_6', card: { brand: 'visa', last4: '4242 4242 4242 4242' } }] })
    const [b] = await BillingApi.paymentMethods()
    expect(b.last4).toBe('4242')
  })

  it('degrades a method with no card descriptor to undefined fields, never fabricated', async () => {
    stubJson({ data: [{ id: 'pm_4', type: 'bank_account' }] })
    const [m] = await BillingApi.paymentMethods()
    expect(m.last4).toBeUndefined()
    expect(m.brand).toBeUndefined()
    expect(m.expMonth).toBeUndefined()
  })

  it('is honest-empty for an org with no payment methods', async () => {
    stubJson({ paymentMethods: [] })
    expect(await BillingApi.paymentMethods()).toEqual([])
  })
})

/**
 * The commerce route names dropped their compound prefixes — the `/v1/billing/`
 * namespace already says "billing", so `billing/payment-methods` stuttered. The
 * server registers ONLY the short names; `payment-methods` and `payment-config` are
 * 404. These pin the READ urls, which nothing else asserts: every other suite here
 * stubs a body and checks normalization, so a client pointed at a dead route still
 * went green — which is exactly how the console kept calling 404s while its tests
 * passed. One name per concept, pinned where the request is actually made.
 */
describe('read paths address the canonical short route names', () => {
  afterEach(teardown)

  it('GETs the saved methods from /v1/billing/methods (never payment-methods)', async () => {
    const calls = captureFetch({ paymentMethods: [] })
    await BillingApi.paymentMethods()
    expect(calls[0].url).toBe(`${ORIGIN}/v1/billing/methods`)
    expect(calls[0].init.method ?? 'GET').toBe('GET')
  })

  it('GETs the card-processor config from /v1/billing/settings (never payment-config)', async () => {
    const calls = captureFetch({ provider: 'square', applicationId: 'sq-app', locationId: 'sq-loc', environment: 'production', live: true })
    const cfg = await BillingApi.paymentConfig()
    expect(calls[0].url).toBe(`${ORIGIN}/v1/billing/settings`)
    expect(cfg.applicationId).toBe('sq-app')
  })

  it('GETs the spend alerts from /v1/billing/alerts (never spend-alerts)', async () => {
    const calls = captureFetch({ alerts: [] })
    await BillingApi.spendAlerts()
    expect(calls[0].url).toBe(`${ORIGIN}/v1/billing/alerts`)
  })
})

/**
 * Add / remove payment methods (in-console, task D). The card is tokenized in
 * Square's iframe; the client sends ONLY the opaque nonce — NEVER a PAN. These pin
 * the exact request the client makes to the per-tenant `/v1/billing/*` proxy.
 */
describe('BillingApi.createPaymentMethod — saves a Square nonce, never a PAN', () => {
  afterEach(teardown)

  it('POSTs { type, token } to /v1/billing/methods and returns the masked method', async () => {
    const calls = captureFetch({ id: 'pm_new', type: 'card', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } })
    const m = await BillingApi.createPaymentMethod({ type: 'card', token: 'cnon:card-nonce-ok' })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${ORIGIN}/v1/billing/methods`)
    expect(calls[0].init.method).toBe('POST')
    const sent = JSON.parse(calls[0].init.body as string) as Record<string, unknown>
    expect(sent).toEqual({ type: 'card', token: 'cnon:card-nonce-ok' })

    // The returned display shape is masked (brand + last4 only).
    expect(m.id).toBe('pm_new')
    expect(m.brand).toBe('visa')
    expect(m.last4).toBe('4242')
  })

  it('sends NO PAN / CVV — only the nonce leaves the browser', async () => {
    const calls = captureFetch({ id: 'pm_new' })
    await BillingApi.createPaymentMethod({ type: 'card', token: 'cnon:only-this' })
    const raw = calls[0].init.body as string
    // The single-use nonce is the ONLY card artifact in the request body.
    expect(raw).toContain('cnon:only-this')
    expect(raw).not.toMatch(/\b\d{13,19}\b/) // no PAN-length digit run
    const sent = JSON.parse(raw) as Record<string, unknown>
    for (const leak of ['number', 'pan', 'cvc', 'cvv', 'card']) expect(sent[leak]).toBeUndefined()
  })

  it('unwraps a wrapped create response ({ paymentMethod: {...} })', async () => {
    captureFetch({ paymentMethod: { id: 'pm_w', card: { brand: 'amex', last4: '0005' } } })
    const m = await BillingApi.createPaymentMethod({ token: 'cnon:x' })
    expect(m.id).toBe('pm_w')
    expect(m.brand).toBe('amex')
    expect(m.last4).toBe('0005')
  })

  it('defaults the method type to "card" when omitted', async () => {
    const calls = captureFetch({ id: 'pm_d' })
    await BillingApi.createPaymentMethod({ token: 'cnon:y' })
    expect(JSON.parse(calls[0].init.body as string).type).toBe('card')
  })
})

describe('BillingApi.removePaymentMethod — detaches by id (DELETE)', () => {
  afterEach(teardown)

  it('DELETEs /v1/billing/methods/:id (url-encoded id)', async () => {
    const calls = captureFetch({}, 200)
    await BillingApi.removePaymentMethod('pm_1')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${ORIGIN}/v1/billing/methods/pm_1`)
    expect(calls[0].init.method).toBe('DELETE')
    expect(calls[0].init.body).toBeUndefined() // a detach carries no body
  })

  it('encodes an id with unsafe characters (no path injection)', async () => {
    const calls = captureFetch({}, 204)
    await BillingApi.removePaymentMethod('pm/../secret')
    expect(calls[0].url).toBe(`${ORIGIN}/v1/billing/methods/pm%2F..%2Fsecret`)
  })
})

/**
 * Cancel / reactivate subscriptions (in-console, task E). The `:id` comes from the
 * caller's own scoped list; the proxy authorizes it server-side. These pin the exact
 * request + the cancel-state reflected back into the row.
 */
describe('BillingApi.cancelSubscription — at-period-end vs now', () => {
  afterEach(teardown)

  it('POSTs {atPeriodEnd:true} to /subscriptions/:id/cancel and reflects the scheduled cancel', async () => {
    const calls = captureFetch({ id: 'sub_1', status: 'active', cancel_at_period_end: true, current_period_end: 1893456000 })
    const s = await BillingApi.cancelSubscription('sub_1', true)
    expect(calls[0].url).toBe(`${ORIGIN}/v1/billing/subscriptions/sub_1/cancel`)
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ atPeriodEnd: true })
    expect(s.cancelAtPeriodEnd).toBe(true)
  })

  it('POSTs {atPeriodEnd:false} for an immediate cancel and reflects canceledAt', async () => {
    const calls = captureFetch({ id: 'sub_2', status: 'canceled', canceled_at: 1893456000 })
    const s = await BillingApi.cancelSubscription('sub_2', false)
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ atPeriodEnd: false })
    expect(s.status).toBe('canceled')
    expect(s.canceledAt).toBe(new Date(1893456000 * 1000).toISOString())
  })
})

describe('BillingApi.reactivateSubscription — clears the scheduled cancel', () => {
  afterEach(teardown)

  it('POSTs to /subscriptions/:id/reactivate and reflects the cleared cancel state', async () => {
    const calls = captureFetch({ id: 'sub_1', status: 'active', cancel_at_period_end: false })
    const s = await BillingApi.reactivateSubscription('sub_1')
    expect(calls[0].url).toBe(`${ORIGIN}/v1/billing/subscriptions/sub_1/reactivate`)
    expect(calls[0].init.method).toBe('POST')
    expect(s.cancelAtPeriodEnd).toBe(false)
  })
})

describe('normalizeSubscriptions — cancel state (cancelAtPeriodEnd / canceledAt)', () => {
  afterEach(teardown)

  it('reads snake_case cancel_at_period_end + canceled_at', async () => {
    stubJson({
      subscriptions: [
        { id: 's1', status: 'active', cancel_at_period_end: true, current_period_end: 1893456000 },
        { id: 's2', status: 'canceled', canceled_at: 1893456000 },
      ],
    })
    const [a, b] = await BillingApi.subscriptions()
    expect(a.cancelAtPeriodEnd).toBe(true)
    expect(a.canceledAt).toBeUndefined()
    expect(b.canceledAt).toBe(new Date(1893456000 * 1000).toISOString())
  })

  it('defaults cancelAtPeriodEnd to false and canceledAt to undefined (never fabricated)', async () => {
    stubJson({ subscriptions: [{ id: 's3', status: 'active' }] })
    const [s] = await BillingApi.subscriptions()
    expect(s.cancelAtPeriodEnd).toBe(false)
    expect(s.canceledAt).toBeUndefined()
  })
})
