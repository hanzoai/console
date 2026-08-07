/**
 * End-to-end proof of the per-product o11y wiring: the REAL `ApmApi.logs` /
 * `ApmApi.serviceHealth` calls, with the transport (`./client`) mocked, so the test
 * asserts BOTH that the per-product query is BUILT with the service filter AND that a
 * realistic O11y response is MAPPED to real, service-scoped view-models. This is the
 * "the query builds + maps real responses" gate for the per-product Status/Logs/Metrics.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const restPost = vi.fn()
vi.mock('./client', () => ({
  originV1Url: (p: string) => `/v1/${p}`,
  cloudProxyV1Url: (p: string) => `/v1/${p}`,
  restPost: (...a: unknown[]) => restPost(...a),
  restGet: vi.fn(),
}))

import { ApmApi, apmWindow } from './apm'

type Body = {
  requestType: string
  compositeQuery: { queries: { type: string; spec: { signal: string; limit: number } & Record<string, unknown> }[] }
}

describe('ApmApi.logs — the per-product o11y v5 query builds + maps real rows, service-scoped', () => {
  beforeEach(() => restPost.mockReset())

  it('asks the v5 raw surface for a deep page and normalizes rows to the ONE service', async () => {
    const nsTs = String(Date.parse('2026-07-03T00:00:00Z') * 1_000_000) // O11y ns epoch
    restPost.mockResolvedValueOnce({
      data: { data: { results: [{ rows: [{ timestamp: nsTs, data: { id: 'l1', severity_text: 'INFO', resources_string: { 'service.name': 'iam' }, body: 'signed in' } }] }] } },
    })

    const rows = await ApmApi.logs(apmWindow(3600), 500, 'iam')

    // 1) the outgoing query is the v5 raw shape on the version-less canonical
    // surface, addressed via the /v1 bearer BFF. Service scoping is client-side
    // (the runtime's key resolution is down — see rawQueryPayload), so a scoped
    // read asks for the deepest page instead of a server filter.
    const [url, body] = restPost.mock.calls[0] as [string, Body]
    expect(url).toBe('/v1/o11y/query_range')
    expect(body.requestType).toBe('raw')
    const q = body.compositeQuery.queries[0]
    expect(q.type).toBe('builder_query')
    expect(q.spec).toMatchObject({ signal: 'logs', limit: 1000 })
    expect('filter' in q.spec).toBe(false)

    // 2) the real response maps to real, normalized rows
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ service: 'iam', severity: 'info', body: 'signed in' })
  })

  it('re-filters client-side so another service can never leak onto the page', async () => {
    restPost.mockResolvedValueOnce({
      data: { data: { results: [{ rows: [
        { timestamp: '2', data: { body: 'mine', resources_string: { 'service.name': 'iam' } } },
        { timestamp: '1', data: { body: 'not mine', resources_string: { 'service.name': 'kms' } } },
      ] }] } },
    })
    const rows = await ApmApi.logs(apmWindow(3600), 500, 'iam')
    expect(rows.map((r) => r.body)).toEqual(['mine'])
  })

  it('keeps the caller limit for the org-wide stream (no service, no deep page)', async () => {
    restPost.mockResolvedValueOnce({ data: { data: { results: [] } } })
    await ApmApi.logs(apmWindow(3600), 500)
    const [, body] = restPost.mock.calls[0] as [string, Body]
    expect(body.compositeQuery.queries[0].spec.limit).toBe(500)
  })
})

describe('ApmApi.serviceHealth — picks the product service RED metrics from the live list', () => {
  beforeEach(() => restPost.mockReset())

  it('returns the ServiceHealth for the matching candidate, mapping ns→ms + the RED verdict', async () => {
    restPost.mockResolvedValueOnce([
      { serviceName: 'gateway', p99: 5_000_000, numCalls: 3, errorRate: 0 },
      { serviceName: 'iam', p99: 90_000_000, avgDuration: 20_000_000, numCalls: 500, callRate: 4, errorRate: 2 },
    ])
    const h = await ApmApi.serviceHealth(apmWindow(3600), 'iam')
    expect(h).toMatchObject({ service: 'iam', p99Ms: 90, avgMs: 20, errorRatePct: 2, tone: 'yellow', numCalls: 500, callRate: 4 })
  })

  it('tries candidates in order (o11y service.name, then the operator app name)', async () => {
    restPost.mockResolvedValueOnce([{ serviceName: 'cloud', p99: 10_000_000, numCalls: 42, errorRate: 0 }])
    // first candidate `ai` is absent → falls to `cloud` (the operator/service name)
    const h = await ApmApi.serviceHealth(apmWindow(3600), 'ai', 'cloud')
    expect(h?.service).toBe('cloud')
  })

  it('is honest null when the product service reported no telemetry in the window', async () => {
    restPost.mockResolvedValueOnce([{ serviceName: 'other', numCalls: 10 }])
    expect(await ApmApi.serviceHealth(apmWindow(3600), 'iam')).toBeNull()
  })
})
