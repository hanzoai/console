import { describe, expect, it } from 'vitest'

import {
  categoryIsOpen,
  toggleCategory,
  productIsOpen,
  toggleProduct,
  NAV_OPEN_PREF,
  NAV_PRODUCT_OPEN_PREF,
  type CategoryOpen,
} from './nav-accordion'

const ctx = (filtering = false) => ({ filtering })

describe('categoryIsOpen (expand-by-default)', () => {
  it('defaults to EXPANDED for an untouched category (nothing auto-collapses)', () => {
    expect(categoryIsOpen({}, 'AI', ctx())).toBe(true)
    expect(categoryIsOpen({}, 'Observe', ctx())).toBe(true)
    expect(categoryIsOpen({ Data: false }, 'AI', ctx())).toBe(true) // untouched section stays open
  })

  it('respects an explicit COLLAPSE, and stays where the user left it', () => {
    expect(categoryIsOpen({ Observe: false }, 'Observe', ctx())).toBe(false)
    // a re-opened section (explicit true) stays open
    expect(categoryIsOpen({ Observe: true }, 'Observe', ctx())).toBe(true)
  })

  it('each section is INDEPENDENT — collapsing one leaves the others expanded', () => {
    const stored: CategoryOpen = { Observe: false }
    expect(categoryIsOpen(stored, 'Observe', ctx())).toBe(false)
    expect(categoryIsOpen(stored, 'AI', ctx())).toBe(true)
    expect(categoryIsOpen(stored, 'Platform', ctx())).toBe(true)
  })

  it('opens every group while filtering, so a search match is never hidden', () => {
    expect(categoryIsOpen({ AI: false }, 'AI', ctx(true))).toBe(true)
    expect(categoryIsOpen({ Observe: false }, 'Observe', ctx(true))).toBe(true)
  })

  it('restores the stored/default state once filtering clears', () => {
    const stored: CategoryOpen = { AI: false, Data: true }
    expect(categoryIsOpen(stored, 'AI', ctx(false))).toBe(false)
    expect(categoryIsOpen(stored, 'Data', ctx(false))).toBe(true)
    expect(categoryIsOpen(stored, 'Compute', ctx(false))).toBe(true) // untouched → open
  })
})

describe('toggleCategory (independent per-section)', () => {
  it('collapses a default-open (untouched) category on first toggle', () => {
    expect(toggleCategory({}, 'AI')).toEqual({ AI: false })
  })

  it('re-opens an explicitly-collapsed category', () => {
    expect(toggleCategory({ AI: false }, 'AI')).toEqual({ AI: true })
  })

  it('round-trips: toggling twice returns to the default-open state (stored true)', () => {
    const once = toggleCategory({}, 'Observe')
    expect(once).toEqual({ Observe: false })
    const twice = toggleCategory(once, 'Observe')
    expect(twice).toEqual({ Observe: true })
    expect(categoryIsOpen(twice, 'Observe', ctx())).toBe(true)
  })

  it('NEVER touches other sections (independent — not single-open)', () => {
    // collapsing AI leaves an already-collapsed Observe collapsed and everything else default-open
    expect(toggleCategory({ Observe: false }, 'AI')).toEqual({ Observe: false, AI: false })
    // opening a second section does NOT collapse the first (the old single-open invariant is gone)
    expect(toggleCategory({ Observe: false, Data: false }, 'AI')).toEqual({ Observe: false, Data: false, AI: false })
  })

  it('is immutable — never mutates the input state', () => {
    const stored: CategoryOpen = { AI: false }
    const next = toggleCategory(stored, 'AI')
    expect(stored).toEqual({ AI: false })
    expect(next).not.toBe(stored)
  })
})

describe('productIsOpen / toggleProduct', () => {
  // Where you are is the one product whose options you are certain to want.
  it('opens the ACTIVE product and leaves the others closed', () => {
    expect(productIsOpen({}, 'agents', { filtering: false, active: true })).toBe(true)
    expect(productIsOpen({}, 'models', { filtering: false, active: false })).toBe(false)
  })

  it('respects an explicit choice over the active default, in both directions', () => {
    expect(productIsOpen({ agents: false }, 'agents', { filtering: false, active: true })).toBe(false)
    expect(productIsOpen({ models: true }, 'models', { filtering: false, active: false })).toBe(true)
  })

  // The filter narrows PRODUCTS; a matched product's sub-pages are not themselves
  // matches, so expanding them would push the other hits off screen.
  it('closes everything while filtering, active or not', () => {
    expect(productIsOpen({}, 'agents', { filtering: true, active: true })).toBe(false)
    expect(productIsOpen({ agents: true }, 'agents', { filtering: true, active: true })).toBe(false)
  })

  // Whichever way the chevron points, the click does that.
  it('first click on the active one collapses it; on any other one expands it', () => {
    expect(toggleProduct({}, 'agents', { active: true })).toEqual({ agents: false })
    expect(toggleProduct({}, 'models', { active: false })).toEqual({ models: true })
  })

  it('leaves every other product untouched and never mutates the input', () => {
    const stored = { models: true }
    expect(toggleProduct(stored, 'agents', { active: false })).toEqual({ models: true, agents: true })
    expect(stored).toEqual({ models: true })
  })

  // Products and categories share a preference SHAPE but not a default, and they are
  // stored under different keys — a product must never inherit a category's open-by-default.
  it('is keyed apart from the category accordion', () => {
    expect(NAV_PRODUCT_OPEN_PREF).not.toBe(NAV_OPEN_PREF)
  })
})
