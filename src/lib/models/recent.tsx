'use client'

/**
 * Recently used models — the small per-user trail behind the Models page's
 * Recent chips.
 *
 * A use is recorded wherever a model is genuinely exercised (a chat turn sent,
 * a catalog detail opened), and the trail rides the ONE account-backed
 * preferences store — the same home `useList` and pins use — so it follows the
 * user across devices instead of living in one browser's localStorage.
 *
 * The pure ops are exported for tests; the hook is the one binding surfaces use.
 */
import { useCallback } from 'react'

import { usePreferences } from '~/lib/products/preferences'

const KEY = 'models.recent'

/** How many recents are kept — a trail you can scan, not a history. */
export const RECENT_CAP = 6

/** `ids` with `id` promoted to the front, deduplicated case-insensitively,
 *  capped at `cap`. PURE — the ONE way a use is recorded. */
export function remember(ids: readonly string[], id: string, cap = RECENT_CAP): string[] {
  const key = id.trim().toLowerCase()
  if (!key) return [...ids].slice(0, cap)
  return [id.trim(), ...ids.filter((x) => x.toLowerCase() !== key)].slice(0, cap)
}

/** Whatever a past version stored, as a clean bounded string list. PURE. */
export function normalizeRecent(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, RECENT_CAP)
}

/** The user's recently used models, most recent first, account-persisted. */
export function useRecentModels(): { recent: string[]; record: (id: string) => void } {
  const { get, set } = usePreferences()
  const recent = normalizeRecent(get<unknown>(KEY, []))
  const record = useCallback(
    (id: string) => set(KEY, remember(normalizeRecent(get<unknown>(KEY, [])), id)),
    [get, set],
  )
  return { recent, record }
}
