import { describe, it, expect } from 'vitest'

import { RECENT_CAP, normalizeRecent, remember } from './recent'

describe('remember', () => {
  it('puts the newest use first', () => {
    expect(remember(['a', 'b'], 'c')).toEqual(['c', 'a', 'b'])
  })

  it('promotes a repeat use instead of duplicating it', () => {
    expect(remember(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c'])
  })

  it('deduplicates case-insensitively but keeps the recorded spelling', () => {
    expect(remember(['Enso-Flash'], 'enso-flash')).toEqual(['enso-flash'])
  })

  it('caps the trail', () => {
    const full = Array.from({ length: RECENT_CAP }, (_, i) => `m${i}`)
    const next = remember(full, 'new')
    expect(next).toHaveLength(RECENT_CAP)
    expect(next[0]).toBe('new')
    expect(next).not.toContain(`m${RECENT_CAP - 1}`)
  })

  it('ignores a blank id', () => {
    expect(remember(['a'], '  ')).toEqual(['a'])
  })
})

describe('normalizeRecent', () => {
  it('accepts only a list of non-empty strings', () => {
    expect(normalizeRecent(['a', 1, '', null, 'b'])).toEqual(['a', 'b'])
    expect(normalizeRecent('a')).toEqual([])
    expect(normalizeRecent(undefined)).toEqual([])
  })

  it('bounds whatever was stored', () => {
    const stored = Array.from({ length: RECENT_CAP + 5 }, (_, i) => `m${i}`)
    expect(normalizeRecent(stored)).toHaveLength(RECENT_CAP)
  })
})
