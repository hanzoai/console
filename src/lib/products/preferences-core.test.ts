import { describe, expect, it } from 'vitest'

import { mergePrefs, parsePrefs } from './preferences-core'

describe('parsePrefs — a corrupt cache degrades, never throws', () => {
  it('reads a stored object', () => {
    expect(parsePrefs('{"pins":[{"id":"agents","group":""}]}')).toEqual({ pins: [{ id: 'agents', group: '' }] })
  })

  it('treats absent, malformed and non-object blobs as no customizations', () => {
    for (const bad of [undefined, null, '', 'not json', '[]', '"a string"', '42']) {
      expect(() => parsePrefs(bad)).not.toThrow()
      expect(parsePrefs(bad)).toEqual({})
    }
  })
})

describe('mergePrefs — the reconciliation that decides whether a pin survives a reload', () => {
  it('lets the stored document win for a key it CARRIES', () => {
    const merged = mergePrefs({ pins: ['stale'] }, { pins: ['fresh'] })
    expect(merged.pins).toEqual(['fresh'])
  })

  it('keeps a cached key the document is silent about — the regression that lost pins', () => {
    // Measured in a browser: pin a product, reload, and the pin was gone. Treating a
    // key the stored document does not carry as "you have no pins" overwrote the cache
    // with {} on every load, which is also what carries a pre-existing pin forward.
    const cached = { pins: [{ id: 'agents', group: '' }], productColors: { agents: 'iris' } }
    const merged = mergePrefs(cached, { 'guide.used': { overview: true } })
    expect(merged.pins).toEqual(cached.pins)
    expect(merged.productColors).toEqual(cached.productColors)
    expect(merged['guide.used']).toEqual({ overview: true })
  })

  it('a document with nothing to say erases nothing', () => {
    const cached = { pins: ['a'], 'list.models': { q: 'zen' } }
    expect(mergePrefs(cached, {})).toEqual(cached)
  })

  it('is idempotent, so re-running it on each read cannot drift', () => {
    const cached = { pins: ['a'] }
    const stored = { theme: 'dark' }
    const once = mergePrefs(cached, stored)
    expect(mergePrefs(once, stored)).toEqual(once)
  })

  it('mutates neither input', () => {
    const cached = { a: 1 }
    const stored = { b: 2 }
    mergePrefs(cached, stored)
    expect(cached).toEqual({ a: 1 })
    expect(stored).toEqual({ b: 2 })
  })
})
