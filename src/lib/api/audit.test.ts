import { describe, it, expect, afterEach, vi } from 'vitest'
import { AuditApi, normalizeEvent } from './audit'

// Two hosts, and the split is the point: ORIGIN is where the PAGE is served, API
// (`CANONICAL_API_URL`) is where every `/v1` call goes. They no longer coincide.
const ORIGIN = 'https://console.hanzo.ai'
const API = 'https://api.hanzo.ai'

function stubJson(body: unknown, status = 200): { url: string } {
  const captured = { url: '' }
  ;(globalThis as { window?: unknown }).window = {
    location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  }
  vi.stubGlobal('fetch', (url: string) => {
    captured.url = String(url)
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
  })
  return captured
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete (globalThis as { window?: unknown }).window
})

describe('normalizeEvent — mirrors audit.Wire', () => {
  it('maps every field', () => {
    const e = normalizeEvent({
      seq: 7, time: '2026-07-04T12:30:00Z', org: 'maxpower', sub: 'dave', email: 'dave@x.ai',
      action: 'machine.create', resource: 'machine', resourceId: 'm-1', method: 'POST', path: '/v1/machines',
      result: 'success', status: 201, reason: 'ok', sourceIp: '1.2.3.4', userAgent: 'ua', requestId: 'r1',
      isAdmin: true, authMethod: 'jwt', hash: 'bb', prevHash: 'aa',
    })
    expect(e.seq).toBe(7)
    expect(e.action).toBe('machine.create')
    expect(e.resourceId).toBe('m-1')
    expect(e.result).toBe('success')
    expect(e.status).toBe(201)
    expect(e.isAdmin).toBe(true)
    expect(e.hash).toBe('bb')
    expect(e.prevHash).toBe('aa')
  })

  it('degrades a partial row without throwing', () => {
    const e = normalizeEvent({ seq: '9', action: 'x' })
    expect(e.seq).toBe(9)
    expect(e.action).toBe('x')
    expect(e.result).toBe('')
    expect(e.isAdmin).toBe(false)
  })
})

describe('AuditApi.list — org-scoped, filtered, paginated', () => {
  it('builds the filter query and NEVER sends a client org param', async () => {
    const cap = stubJson({ status: 'ok', data: [{ seq: 1, action: 'a' }], data2: 42 })
    await AuditApi.list({ action: 'machine.create', result: 'deny', resourceId: 'm-1', since: '2026-07-01T00:00:00Z', pageSize: 25, page: 2 })
    expect(cap.url).toContain('/v1/audit?')
    expect(cap.url).toContain('action=machine.create')
    expect(cap.url).toContain('result=deny')
    expect(cap.url).toContain('resourceId=m-1')
    expect(cap.url).toContain('since=2026-07-01')
    expect(cap.url).toContain('pageSize=25')
    expect(cap.url).toContain('p=2')
    // Tenant isolation is server-pinned — the client must not offer an `org` param at all.
    expect(cap.url).not.toContain('org=')
  })

  it('decodes the {data, data2} envelope into rows + total', async () => {
    stubJson({ status: 'ok', data: [{ seq: 1, action: 'a' }, { seq: 2, action: 'b' }], data2: 7 })
    const page = await AuditApi.list()
    expect(page.rows).toHaveLength(2)
    expect(page.rows[1].action).toBe('b')
    expect(page.total).toBe(7)
  })

  it('reads the named total first; legacy data2 is only a fallback', async () => {
    stubJson({ status: 'ok', data: [{ seq: 1, action: 'a' }], total: 9, data2: 7 })
    expect((await AuditApi.list()).total).toBe(9)
    stubJson({ status: 'ok', data: [{ seq: 1, action: 'a' }], total: 9 })
    expect((await AuditApi.list()).total).toBe(9)
  })

  it('page 1 and unfiltered omit the p/ filter params (clean URL)', async () => {
    const cap = stubJson({ status: 'ok', data: [], data2: 0 })
    await AuditApi.list({ page: 1 })
    expect(cap.url).toBe(`${API}/v1/audit`)
  })
})
