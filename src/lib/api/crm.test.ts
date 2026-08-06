import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  CrmApi,
  STAGES,
  normalizeCompany,
  normalizeContact,
  normalizeOpportunity,
  normalizeSummary,
  normalizeCompanies,
  normalizeContacts,
  normalizeOpportunities,
} from './crm'

/**
 * CRM API + pure normalizers. The module calls the DOCUMENTED cloud `/v1/crm`
 * contract keyless and prefix-free on the canonical API host (`originV1Url` →
 * `api.hanzo.ai/v1/crm`). These tests pin (1) that each call hits the EXACT `/v1/crm`
 * path there (the canonical Agents/Evals form), (2) that the real store JSON shape
 * (store.go tags) normalizes, (3) list reads any envelope key, and (4) a garbage/absent
 * field degrades to a safe default — never throws.
 */
/** The PAGE origin — where the console is served from. */
const ORIGIN = 'https://console.hanzo.ai'
/** The API host — where it calls, whatever origin it was served from. */
const API = 'https://api.hanzo.ai'

describe('CRM normalizers — real store.go JSON shape, defensive', () => {
  it('normalizes a company with all fields', () => {
    const c = normalizeCompany({
      id: 'comp_1', name: 'Acme', domainName: 'acme.com', employees: 50,
      city: 'SF', country: 'US', arr: 1000000, currency: 'USD',
      idealCustomerProfile: true, linkedinLink: 'x', xLink: 'y', createdAt: 1, updatedAt: 2,
    })
    expect(c).toMatchObject({ id: 'comp_1', name: 'Acme', employees: 50, arr: 1000000, idealCustomerProfile: true })
  })

  it('coerces missing/garbage fields to safe defaults (never throws)', () => {
    const c = normalizeCompany({ id: 'comp_2' })
    expect(c).toMatchObject({ id: 'comp_2', name: '', employees: 0, currency: 'USD', idealCustomerProfile: false })
    // A non-object degrades to an empty (id-less) record, filtered out of lists.
    expect(normalizeCompany(null).id).toBe('')
    expect(normalizeCompanies({ data: [null, 'x', { id: 'comp_3', name: 'Ok' }] }).map((r) => r.id)).toEqual(['comp_3'])
  })

  it('normalizes a contact and an opportunity', () => {
    expect(normalizeContact({ id: 'cont_1', firstName: 'Ada', email: 'a@b.c' })).toMatchObject({
      id: 'cont_1', firstName: 'Ada', email: 'a@b.c', lastName: '',
    })
    expect(normalizeOpportunity({ id: 'oppo_1', name: 'Deal', amount: 500000, stage: 'PROPOSAL' })).toMatchObject({
      id: 'oppo_1', name: 'Deal', amount: 500000, stage: 'PROPOSAL', currency: 'USD',
    })
    // Empty stage defaults to NEW (matches the backend default).
    expect(normalizeOpportunity({ id: 'oppo_2', name: 'x' }).stage).toBe('NEW')
  })

  it('reads lists from any envelope key or a bare array', () => {
    expect(normalizeContacts([{ id: 'a' }, { id: 'b' }]).length).toBe(2)
    expect(normalizeOpportunities({ items: [{ id: 'o1', name: 'n' }] }).length).toBe(1)
    expect(normalizeSummary({ companies: 3, contacts: 7, opportunities: 2 })).toEqual({
      companies: 3, contacts: 7, opportunities: 2,
    })
  })

  it('exposes the Twenty pipeline stages', () => {
    expect(STAGES).toEqual(['NEW', 'SCREENING', 'MEETING', 'PROPOSAL', 'CUSTOMER'])
  })
})

describe('CrmApi — hits the /v1/crm contract on the canonical API host', () => {
  const fetched: { url: string; method: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET' })
      const body =
        url.includes('/summary') ? { companies: 1, contacts: 0, opportunities: 0 } : { data: [{ id: 'comp_1', name: 'Acme' }] }
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('lists companies via the prefix-free /v1/crm path', async () => {
    const out = await CrmApi.companies.list()
    expect(fetched[0]).toEqual({ url: `${API}/v1/crm/companies`, method: 'GET' })
    expect(out.map((c) => c.name)).toEqual(['Acme'])
  })

  it('creates a company with POST through the proxy', async () => {
    await CrmApi.companies.create({ name: 'Acme' })
    expect(fetched[0]).toEqual({ url: `${API}/v1/crm/companies`, method: 'POST' })
  })

  it('reads the per-org summary', async () => {
    const s = await CrmApi.summary()
    expect(fetched[0].url).toBe(`${API}/v1/crm/summary`)
    expect(s.companies).toBe(1)
  })

  it('filters contacts by companyId and lists opportunities by stage', async () => {
    await CrmApi.contacts.list('comp_1')
    await CrmApi.opportunities.list('NEW')
    expect(fetched[0].url).toBe(`${API}/v1/crm/contacts?companyId=comp_1`)
    expect(fetched[1].url).toBe(`${API}/v1/crm/opportunities?stage=NEW`)
  })
})
