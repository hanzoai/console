/**
 * Sidebar category accordion — the pure open/collapse model for the level-1
 * product nav. Each CATEGORY is an INDEPENDENTLY collapsible section; this module
 * holds the tiny decision logic (what renders open, how a toggle mutates it) with
 * NO React, so it is unit-testable in isolation and the shell (`Dashboard`)
 * stays a thin binding over it.
 *
 * EXPAND-BY-DEFAULT: every category renders EXPANDED by default — nothing
 * auto-collapses, so the whole product catalog reads at a glance (OBSERVE, PLATFORM,
 * DEV, APPS, SETTINGS, … all open). A user may explicitly COLLAPSE any section (the
 * optional per-section chevron); that ONE choice is persisted per-user (account-backed
 * + localStorage cache) via `usePreferences` under `NAV_OPEN_PREF` and RESPECTED on
 * every render — the section stays exactly where the user left it. While FILTERING,
 * every section opens so a search match is never hidden behind a collapsed section.
 *
 * This is NOT a single-open accordion: collapsing one section leaves the others
 * untouched (each is independent), so the default is a fully-expanded nav.
 */

/** The user's EXPLICIT per-section open/closed choices (sparse). A MISSING key = the
 *  default (OPEN). A stored `false` = the user collapsed that section; `true` = the
 *  user re-opened one they'd collapsed. Kept as a Record for preference-shape stability. */
export type CategoryOpen = Partial<Record<string, boolean>>

/** Preference key (account-backed prefs) for the accordion open-state. */
export const NAV_OPEN_PREF = 'navCategoriesOpen'

/** A stable empty reference for the prefs fallback (avoids a fresh object per read,
 *  which would otherwise re-trigger memo/effect deps downstream). */
export const EMPTY_OPEN: CategoryOpen = {}

/**
 * Whether a category renders EXPANDED, given the user's stored choices + context:
 *  - while FILTERING: always open, so a match is never hidden behind a collapsed
 *    section (the group list is already narrowed to non-empty matches);
 *  - otherwise: the user's EXPLICIT choice if they made one, else the DEFAULT (OPEN).
 *    A section the user never touched is open; one they collapsed stays collapsed
 *    (and one they re-opened stays open) — it stays where the user left it.
 */
export function categoryIsOpen(
  stored: CategoryOpen,
  category: string,
  ctx: { filtering: boolean },
): boolean {
  if (ctx.filtering) return true
  const v = stored[category]
  return v === undefined ? true : v
}

/**
 * Toggle a single category (pure + immutable — never mutates the input). Each
 * section is INDEPENDENT (NOT single-open): toggling one leaves every other one
 * exactly as it was. A section with no stored choice is OPEN by default, so its
 * first toggle COLLAPSES it (stores `false`); toggling again re-opens it (`true`).
 */
export function toggleCategory(stored: CategoryOpen, category: string): CategoryOpen {
  const current = stored[category] === undefined ? true : stored[category]
  return { ...stored, [category]: !current }
}

// ── Products, which expand IN PLACE ─────────────────────────────────────────
//
// A product with sub-pages expands beneath its own row, so its options appear
// without the rest of the catalog disappearing. This replaced a DRILL — clicking a
// product used to swap the entire rail for that product's sub-nav, behind a "Back to
// all products" button. The options were the same either way; what the drill took
// away was every other product, which is exactly what a person needs to see when the
// reason they clicked was to compare or to move on somewhere else.
//
// The default here is the OPPOSITE of a category's, and deliberately: categories are
// few and describe the whole catalog, so they open; products are many and each brings
// four to eight rows, so opening them all would bury the catalog under its own detail.

/** Preference key for which products are expanded in the rail. */
export const NAV_PRODUCT_OPEN_PREF = 'navProductsOpen'

/**
 * Whether a product's sub-pages render EXPANDED:
 *  - while FILTERING: closed. The filter narrows PRODUCTS, and a matched product's
 *    sub-pages are not themselves matches — expanding them would push the other hits
 *    off screen;
 *  - the ACTIVE product: open, unless the user explicitly collapsed it. Where you are
 *    is the one place whose options you are certain to want;
 *  - otherwise: the user's explicit choice, else CLOSED.
 */
export function productIsOpen(
  stored: CategoryOpen,
  id: string,
  ctx: { filtering: boolean; active: boolean },
): boolean {
  if (ctx.filtering) return false
  const v = stored[id]
  return v === undefined ? ctx.active : v
}

/**
 * Toggle one product's expansion (pure + immutable). The stored value is what the
 * product is being toggled AWAY from, so the first click on the active product
 * collapses it and the first click on any other one expands it — in both cases the
 * click does the thing the chevron was pointing at.
 */
export function toggleProduct(stored: CategoryOpen, id: string, ctx: { active: boolean }): CategoryOpen {
  const current = stored[id] === undefined ? ctx.active : stored[id]
  return { ...stored, [id]: !current }
}
