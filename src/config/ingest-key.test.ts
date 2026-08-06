/**
 * The console's telemetry TENANT, pinned.
 *
 * One artifact serves six brands and every white-label host, and `ingestKey` is the
 * only thing that decides which org this console's own analytics land in. The rules
 * below are the ones that were violated in production — Hanzo's console filed 18
 * rows into a customer org because tenancy came from the visitor's bearer — so they
 * are asserted here rather than left to review.
 */
import { describe, expect, it } from 'vitest'

import { brandFromHost, resolveConfig, type BrandId } from '~/config'

const BRAND_HOSTS: Record<BrandId, string> = {
  hanzo: 'console.hanzo.ai',
  lux: 'cloud.lux.cloud',
  zoo: 'cloud.zoo.cloud',
  pars: 'cloud.pars.cloud',
  '7stars': 'cloud.7stars.dev',
  yotoda: 'cloud.yotoda.tech',
}

describe('the telemetry tenant is the brand, never the visitor', () => {
  it('gives a hanzo host the hanzo org key on every face', () => {
    for (const host of ['console.hanzo.ai', 'cloud.hanzo.ai', 'admin.hanzo.ai', 'billing.hanzo.ai']) {
      expect(resolveConfig(host).ingestKey).toBe('pk-live-c88649f1085fb6ad441d8a0072933a9b')
    }
  })

  it('only ever ships a publishable key — cloud refuses anything without the pk- prefix', () => {
    // `PublishablePrefix = "pk-"` (cloud/auth_identity.go). The retired `pk_` spelling
    // is not merely a different family, it is unrecognized: the door answers
    // 401 ingest_key_required, which is how ui.hanzo.ai lost 100% of its events.
    for (const host of Object.values(BRAND_HOSTS)) {
      const key = resolveConfig(host).ingestKey
      if (key) expect(key.startsWith('pk-')).toBe(true)
    }
  })

  it('never lets two brands share one key', () => {
    const keys = Object.values(BRAND_HOSTS)
      .map((h) => resolveConfig(h).ingestKey)
      .filter(Boolean)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('fails closed for a brand with no key of its own, rather than borrowing hanzo’s', () => {
    for (const brand of ['lux', 'zoo', 'pars', '7stars', 'yotoda'] as BrandId[]) {
      expect(resolveConfig(BRAND_HOSTS[brand]).ingestKey).toBe('')
    }
  })

  it('withholds the key from a host no brand claims, even though the BRAND defaults to hanzo', () => {
    // The default is right for a wordmark and wrong for a tenant. `yadota.tech`
    // serves this console live and matches no suffix (HOST_BRANDS spells that
    // tenant `yotoda.tech`, which has no DNS), so it is the host that actually
    // exercises this path — it must emit nothing, not into Hanzo's org.
    for (const host of ['yadota.tech', 'cloud.yadota.tech', 'console.example.com', '']) {
      expect(brandFromHost(host)).toBe('hanzo')
      expect(resolveConfig(host).ingestKey).toBe('')
    }
  })

  it('keeps brand resolution itself unchanged', () => {
    expect(brandFromHost('cloud.lux.cloud')).toBe('lux')
    expect(brandFromHost('CONSOLE.HANZO.AI')).toBe('hanzo')
    expect(brandFromHost('cloud.zoo.ngo')).toBe('zoo')
  })
})
