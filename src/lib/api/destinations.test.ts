import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  DestinationsApi,
  connectBody,
  destinationState,
  missingField,
  needsSecret,
  normalizeDestination,
  normalizeDestinations,
  normalizeTest,
  secretKey,
  secretLabel,
  type Destination,
} from './destinations'

/**
 * Destinations — the org's server-side conversion sinks. These tests pin the two
 * properties that matter most: (1) a credential never leaves the module in a readable
 * form and an omitted one is genuinely omitted (so editing a connected destination does
 * not wipe its sealed secret), and (2) each call hits the same-origin, prefix-free
 * `/v1/destinations` contract — never a direct cloud-origin call, which 403s.
 */
const ORIGIN = 'https://console.hanzo.ai'

const dest = (over: Partial<Destination> = {}): Destination => ({
  platform: 'ga4',
  name: 'Google Analytics 4',
  category: 'Analytics',
  connected: false,
  enabled: false,
  live: false,
  account: '',
  config: {},
  fields: [{ key: 'measurementId', label: 'Measurement ID', required: true, example: 'G-XXXXXXX' }],
  secrets: ['api_secret'],
  ...over,
})

describe('Destination normalizers — the real status-card shape, defensively', () => {
  it('normalizes a connected card, keeping fields and secret NAMES', () => {
    const d = normalizeDestination({
      platform: 'meta',
      name: 'Meta (Facebook & Instagram)',
      category: 'Advertising',
      connected: true,
      enabled: true,
      live: true,
      account: 'Acme Ads',
      config: { pixelId: '179' },
      fields: [{ key: 'pixelId', label: 'Pixel ID', required: true, example: '1234' }],
      secrets: ['access_token'],
    })
    expect(d.platform).toBe('meta')
    expect(d.config).toEqual({ pixelId: '179' })
    expect(d.secrets).toEqual(['access_token'])
    expect(d.live).toBe(true)
  })

  it('reads the {destinations:[…]} envelope and drops a row with no platform', () => {
    const rows = normalizeDestinations({ destinations: [{ platform: 'ga4' }, { name: 'orphan' }] })
    expect(rows.map((d) => d.platform)).toEqual(['ga4'])
  })

  it('degrades garbage to an empty list and a safe card — never throws', () => {
    for (const bad of [null, 'nope', 42, {}]) expect(normalizeDestinations(bad)).toEqual([])
    const d = normalizeDestination(null)
    expect(d.fields).toEqual([])
    expect(d.secrets).toEqual([])
    expect(d.connected).toBe(false)
  })

  it('coerces the connected/live flags strictly — a truthy string is not connected', () => {
    const d = normalizeDestination({ platform: 'ga4', connected: 'yes', live: 1 })
    expect(d.connected).toBe(false)
    expect(d.live).toBe(false)
  })
})

describe('secret naming', () => {
  it('camelCases a KMS secret name for the connect body', () => {
    expect(secretKey('api_secret')).toBe('apiSecret')
    expect(secretKey('access_token')).toBe('accessToken')
    expect(secretKey('oauth2')).toBe('oauth2')
  })

  it('labels a secret without inventing capitals mid-phrase', () => {
    expect(secretLabel('api_secret')).toBe('Api secret')
    expect(secretLabel('access_token')).toBe('Access token')
  })
})

describe('connectBody — what actually goes on the wire', () => {
  it('sends the platform-declared fields plus each secret under its camelCase name', () => {
    const body = connectBody(dest(), { measurementId: 'G-ABC' }, { api_secret: 'sh-1' })
    expect(body).toEqual({ measurementId: 'G-ABC', apiSecret: 'sh-1' })
  })

  it('OMITS an empty secret so an edit keeps the sealed one rather than blanking it', () => {
    const body = connectBody(dest({ connected: true, live: true }), { measurementId: 'G-ABC' }, { api_secret: '  ' })
    expect(body).toEqual({ measurementId: 'G-ABC' })
    expect(body).not.toHaveProperty('apiSecret')
  })

  it('drops a blank optional field rather than storing whitespace, and trims values', () => {
    const d = dest({
      fields: [
        { key: 'pixelId', label: 'Pixel ID', required: true, example: '' },
        { key: 'testEventCode', label: 'Test event code', required: false, example: '' },
      ],
      secrets: [],
    })
    expect(connectBody(d, { pixelId: ' 179 ', testEventCode: '   ' }, {})).toEqual({ pixelId: '179' })
  })

  it('carries account + enabled only when the caller sets them', () => {
    expect(connectBody(dest(), { measurementId: 'G' }, {}, { account: ' Acme ', enabled: false })).toMatchObject({
      account: 'Acme',
      enabled: false,
    })
    expect(connectBody(dest(), { measurementId: 'G' }, {})).not.toHaveProperty('enabled')
  })

  it('never forwards a value for a field the platform did not declare', () => {
    const body = connectBody(dest(), { measurementId: 'G-ABC', sneaky: 'x' }, {})
    expect(body).not.toHaveProperty('sneaky')
  })
})

describe('form gates', () => {
  it('names the first missing REQUIRED field instead of letting cloud 400', () => {
    expect(missingField(dest(), {})?.key).toBe('measurementId')
    expect(missingField(dest(), { measurementId: ' ' })?.key).toBe('measurementId')
    expect(missingField(dest(), { measurementId: 'G-ABC' })).toBeNull()
  })

  it('asks for a credential on a NEW connection and on one that stopped resolving', () => {
    expect(needsSecret(dest())).toBe(true)
    expect(needsSecret(dest({ connected: true, live: false }))).toBe(true)
    expect(needsSecret(dest({ connected: true, live: true }))).toBe(false)
    expect(needsSecret(dest({ secrets: [] }))).toBe(false)
  })

  it('reads one honest state word per card', () => {
    expect(destinationState(dest())).toBe('off')
    expect(destinationState(dest({ connected: true, live: false }))).toBe('reconnect')
    expect(destinationState(dest({ connected: true, live: true, enabled: false }))).toBe('paused')
    expect(destinationState(dest({ connected: true, live: true, enabled: true }))).toBe('live')
  })
})

describe('normalizeTest — a platform rejection is DATA, not an error', () => {
  it('keeps a real sent count of 0 distinct from "did not say"', () => {
    expect(normalizeTest({ ok: true, sent: 0 }).sent).toBe(0)
    expect(normalizeTest({ ok: true }).sent).toBeNull()
  })

  it('carries the platform message on success and its rejection on failure', () => {
    expect(normalizeTest({ ok: true, sent: 1, message: 'accepted' })).toEqual({
      ok: true,
      sent: 1,
      message: 'accepted',
      error: '',
    })
    expect(normalizeTest({ ok: false, error: 'bad pixel' }).error).toBe('bad pixel')
  })
})

describe('DestinationsApi — same-origin /v1/destinations, prefix-free', () => {
  const fetched: { url: string; method: string; body?: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined })
      if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }))
      const body = url.endsWith('/test')
        ? { ok: true, sent: 1 }
        : url.endsWith('/destinations')
          ? { destinations: [{ platform: 'ga4', name: 'Google Analytics 4' }] }
          : { platform: 'ga4', connected: true, live: true }
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('lists through the same-origin path, never a direct cloud-origin call', async () => {
    const out = await DestinationsApi.list()
    expect(fetched[0]).toMatchObject({ url: `${ORIGIN}/v1/destinations`, method: 'GET' })
    expect(fetched[0].url).not.toContain('/api/')
    expect(out.map((d) => d.platform)).toEqual(['ga4'])
  })

  it('connects, disconnects and tests one platform, url-encoding the slug', async () => {
    await DestinationsApi.connect('ga4', { measurementId: 'G-ABC' })
    await DestinationsApi.disconnect('ga4')
    await DestinationsApi.test('ga4')
    expect(fetched[0]).toMatchObject({ url: `${ORIGIN}/v1/destinations/ga4`, method: 'POST' })
    expect(fetched[1]).toMatchObject({ url: `${ORIGIN}/v1/destinations/ga4`, method: 'DELETE' })
    expect(fetched[2]).toMatchObject({ url: `${ORIGIN}/v1/destinations/ga4/test`, method: 'POST' })

    fetched.length = 0
    await DestinationsApi.disconnect('a/b')
    expect(fetched[0].url).toBe(`${ORIGIN}/v1/destinations/a%2Fb`)
  })

  it('a connect response is a status card — it carries no secret back', async () => {
    const out = await DestinationsApi.connect('ga4', { measurementId: 'G-ABC', apiSecret: 'sh-1' })
    expect(out).not.toHaveProperty('apiSecret')
    expect(Object.values(out.config)).not.toContain('sh-1')
    expect(out.live).toBe(true)
  })
})
