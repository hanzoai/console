/**
 * Preference reconciliation — the pure half of the account-backed store, so the
 * one decision that decides whether a user's customizations survive a reload is
 * unit-tested in isolation (no React, no session, no network).
 *
 * The decision: the stored document is authoritative for every key it ACTUALLY
 * CARRIES; the local cache fills the rest. It is NOT authoritative for keys it is
 * silent about, because silence and emptiness are different things — and a user
 * whose customizations predate the preference plane has them only in the cache.
 *
 * This used to be an ORDERING problem, and it no longer is. The console had no way
 * to read the document: it recovered preferences from a snapshot of them carried in
 * the identity token's claims, so anything saved after the token was minted was
 * missing, and a merge had to guess which side was newer from two timestamps.
 * Reading the document itself removes the guess — there is one stored value, and it
 * is the value.
 */

/** A user's preferences: an open map of key → whatever that key stores. */
export type Preferences = Record<string, unknown>

/**
 * Parse a stored preferences blob. Anything that isn't a JSON object — absent,
 * malformed, an array, a bare string — reads as empty rather than throwing, so a
 * corrupt cache degrades to "no customizations" instead of a blank console.
 */
export function parsePrefs(raw: string | undefined | null): Preferences {
  if (!raw) return {}
  try {
    const p: unknown = JSON.parse(raw)
    return p && typeof p === 'object' && !Array.isArray(p) ? (p as Preferences) : {}
  } catch {
    return {}
  }
}

/**
 * Reconcile the fast-paint cache with the stored document. Stored keys win; cached
 * keys the document is silent about survive. Neither input is mutated.
 */
export function mergePrefs(cached: Preferences, stored: Preferences): Preferences {
  return { ...cached, ...stored }
}
