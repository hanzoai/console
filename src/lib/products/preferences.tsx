'use client'

/**
 * User preferences — the ONE account-backed store for every console/product
 * customization (pinned favorites, layout, and anything added later).
 *
 * Source of truth is the user's own document on the cross-surface preference plane
 * (`AccountApi.preferences`), so customizations follow the user across every product
 * and every device. localStorage is the fast-paint cache that avoids a flash before
 * the document loads, AND the fallback for keys the document does not carry — see
 * `mergePrefs` in `preferences-core`.
 *
 * Writes are optimistic + write-through: the local view updates immediately and the
 * plane persists the change (self-scoped, shallow-merged server-side so concurrent
 * products/devices don't clobber each other).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { AccountApi } from '~/lib/api'
import { useSession } from '~/lib/auth/session'
import { mergePrefs, parsePrefs, type Preferences } from './preferences-core'

type PreferencesState = {
  prefs: Preferences
  /** False until the account has been read (the fast-paint cache may show first). */
  ready: boolean
  /** Read a typed preference with a fallback. */
  get: <T>(key: string, fallback: T) => T
  /** Set a preference (optimistic; persisted to the account across devices). */
  set: (key: string, value: unknown) => void
}

const PreferencesContext = createContext<PreferencesState | null>(null)

const cacheKey = (name: string | undefined) => `hanzo.console2.prefs.${name ?? 'anon'}`

const readCache = (name: string | undefined): Preferences =>
  typeof window === 'undefined' ? {} : parsePrefs(window.localStorage.getItem(cacheKey(name)))

export function Preferences({ children }: { children: ReactNode }) {
  const { account } = useSession()
  const name = account?.name
  const [prefs, setPrefs] = useState<Preferences>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Fast-paint from the local cache so pins don't flash on a cold load…
    const cached = readCache(name)
    setPrefs(cached)
    if (!account) return
    // …then read the stored document, which is the live store rather than a snapshot
    // of it, so it is simply authoritative for every key it carries. The cache keeps
    // the keys it is silent about, which is what carries a customization saved before
    // this plane existed. Writing the MERGE back is what makes it survive the reload.
    // A failed read leaves the cache showing — never an empty console.
    let live = true
    AccountApi.preferences()
      .then((stored) => {
        if (!live) return
        const merged = mergePrefs(cached, stored)
        setPrefs(merged)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(cacheKey(name), JSON.stringify(merged))
        }
      })
      .catch(() => {})
      .finally(() => {
        if (live) setReady(true)
      })
    return () => {
      live = false
    }
  }, [account, name])

  const set = useCallback(
    (key: string, value: unknown) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value }
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(cacheKey(name), JSON.stringify(next))
        }
        // Write-through to the stored document (self-scoped server-side). Optimistic
        // in the UI; a failure leaves the local + cache view and the stored document
        // stays authoritative, so the next load reconciles honestly.
        void AccountApi.updatePreferences({ [key]: value }).catch(() => {})
        return next
      })
    },
    [name],
  )

  const get = useCallback(
    <T,>(key: string, fallback: T): T => {
      const v = prefs[key]
      return v === undefined ? fallback : (v as T)
    },
    [prefs],
  )

  const value = useMemo<PreferencesState>(() => ({ prefs, ready, get, set }), [prefs, ready, get, set])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesState {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within <Preferences>')
  return ctx
}
