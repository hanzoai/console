'use client'

/**
 * App search and command palette — ONE surface for Apps and ⌘K / Ctrl+K.
 *
 * It is one widget with modes, not four. The query string selects the mode:
 *   - default     fuzzy-filters the product catalog; ↵ jumps to the product
 *                 (in-console route or external tab) — instant across every product.
 *   - `>` prefix  asks the AI (one cloud `/v1` backend) to find a product or
 *                 answer; a clear product match becomes a "Go to …" jump.
 *   - `?` prefix  asks the docs knowledge store (RAG, store=`docs`) and shows the
 *                 grounded answer with any links it cites.
 *
 * Beyond navigation it also runs ACTIONS — toggle theme, show all apps, open
 * settings, switch organization, ask AI / search docs, sign out — ranked by the
 * same query, so ⌘K is ONE surface for "go somewhere" and "do something".
 *
 * PINS are first-class here, not just in the sidebar. A user's pinned products
 * lead the results (their own pin order, via `pinnedFirst`), and every result
 * carries a pin at its right edge — quiet until you reach the row, lit while it is
 * pinned. `⌥↵` pins the selected result WITHOUT leaving the palette, so curating
 * what you keep at hand is the same gesture as finding it: type, ⌥↵, keep going.
 *
 * Everything composes existing pieces: the catalog registry (`searchCatalog` +
 * `openProduct`), the AI client (`AiApi`), the chrome hooks (theme/session/
 * org-scope), and the honest backend-state mapper. Nothing is fabricated —
 * AI/RAG failures degrade to a truthful state card.
 *
 * Keyboard is handled on `window`: ⌘K toggles from anywhere; while open, ↑/↓ move
 * the selection (over actions then products), ↵ activates, ⌥↵ pins/unpins, Esc
 * closes. The header search box and Apps buttons open it; `>` for AI, `?` for docs.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { useThemeSetting } from '@hanzogui/next-theme'
import {
  Anchor,
  Dialog,
  Input,
  ScrollView,
  Spinner,
  Text,
  VisuallyHidden,
  XStack,
  YStack,
} from '@hanzo/gui'
import {
  ArrowRight,
  Building2,
  Command,
  CornerDownLeft,
  House,
  LayoutGrid,
  Lock,
  LogOut,
  Moon,
  Pin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Zap,
} from '@hanzogui/lucide-icons-2'

import { AiApi, IamAdminApi, type Organization } from '~/lib/api'
import { findEntry, type CatalogEntry } from '~/lib/products/registry'
import { assistantState, commandBarSystemPrompt, hanzoAssistantSystemPrompt } from '~/lib/assistant'
import { searchDestinations, type Destination } from '~/lib/products/search'
import { DEFAULT_GROUP_LABEL, pinnedFirst } from '~/lib/products/pins-core'
import { usePins, useProductColors } from '~/lib/products/pins'
import { useAppsBeta } from '~/lib/products/beta'
import { ProductIcon } from '~/components/ui/ProductIcon'
import { openProduct } from '~/lib/products/open'
import { currentOrg, switchOrg } from '~/lib/org-scope'
import { useSession } from '~/lib/auth/session'
import { useIsSuperAdmin } from '~/lib/auth/admin'
import { BackendStateCard, asColor, type BackendState } from '@hanzo/ui/product'

const titleCase = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/**
 * A non-navigation command: a verb the palette can run (toggle theme, browse all
 * apps, switch org, sign out, …). Orthogonal to catalog entries — both are ranked
 * by the same query so ⌘K is ONE surface for "go somewhere" AND "do something".
 */
type PaletteAction = {
  id: string
  label: string
  hint: string
  /** Extra text the query matches against (synonyms). */
  keywords: string
  icon: ComponentType<{ size?: number }>
  /** Runs on activate. Closing the palette (if wanted) is the action's own job. */
  run: () => void
}

/** Substring match over an action's label + synonyms (lowercased query). */
function actionMatches(a: PaletteAction, q: string): boolean {
  if (!q) return false
  return `${a.label} ${a.keywords}`.toLowerCase().includes(q)
}

type Mode = 'catalog' | 'ai' | 'help'

type PaletteApi = {
  isOpen: boolean
  open: () => void
  close: () => void
}

const Ctx = createContext<PaletteApi | null>(null)

export function useCommandPalette(): PaletteApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCommandPalette must be used within <Palette>')
  return ctx
}

type RunState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'nav'; entry: CatalogEntry }
  | { status: 'text'; text: string }
  | { status: 'error'; state: BackendState }

/** Render an answer as lines, then surface any URLs it cites as real links. */
function Answer({ text }: { text: string }) {
  const urls = Array.from(new Set(text.match(/https?:\/\/[^\s)]+/g) ?? []))
  return (
    <YStack gap="$2.5">
      <YStack>
        {text.split('\n').map((line, i) => (
          <Text key={i} fontSize="$3" color="$color12">
            {line === '' ? ' ' : line}
          </Text>
        ))}
      </YStack>
      {urls.length > 0 ? (
        <YStack gap="$1" borderTopWidth={1} borderColor="$borderColor" pt="$2">
          <Text fontSize="$1" color="$color10" fontWeight="500">
            Links
          </Text>
          {urls.map((u) => (
            <Anchor key={u} href={u} target="_blank" fontSize="$2" color="$color12" textDecorationLine="underline">
              {u}
            </Anchor>
          ))}
        </YStack>
      ) : null}
    </YStack>
  )
}

/**
 * The pin at a result row's right edge. Quiet by construction: invisible until the
 * row is reached (hovered via `.hz-pin` + `.hz-row-pin:hover`, or selected by the
 * keyboard), and steady once the product is pinned — so the control appears where
 * the eye already is and the lit ones read as state, not decoration.
 */
function PinToggle({ label, pinned, active, onPress }: { label: string; pinned: boolean; active: boolean; onPress: () => void }) {
  return (
    <XStack
      className={pinned || active ? undefined : 'hz-pin'}
      onPress={(e: { stopPropagation?: () => void }) => {
        // The row itself navigates; pinning must not also open the product.
        e?.stopPropagation?.()
        onPress()
      }}
      cursor="pointer"
      items="center"
      justify="center"
      width={26}
      height={26}
      rounded="$2"
      // NO inline `opacity` prop: Gui compiles one to an atomic rule it injects at
      // `:root ._ops-…` (specificity 0,2,0), which would outrank the `.hz-pin`
      // utility and paint the resting pin at full strength. Resting visibility is
      // the CSS utility's job alone; presence/absence of the class is the switch.
      hoverStyle={{ bg: '$color6' }}
      role="button"
      aria-pressed={pinned}
      aria-label={`${pinned ? 'Unpin' : 'Pin'} ${label}`}
    >
      <Pin size={13} color={pinned ? '$color12' : '$color10'} fill={pinned ? 'currentColor' : 'none'} />
    </XStack>
  )
}

function CatalogRow({
  entry,
  active,
  color,
  pinned,
  onPin,
  onPress,
}: {
  entry: CatalogEntry
  active: boolean
  color?: string
  pinned?: boolean
  onPin?: () => void
  onPress: () => void
}) {
  const Icon = entry.icon
  return (
    <XStack
      className="hz-row-pin"
      onPress={onPress}
      cursor="pointer"
      items="center"
      gap="$3"
      px="$3"
      py="$2.5"
      rounded="$3"
      id={active ? 'cmdk-active' : undefined}
      bg={active ? '$color5' : 'transparent'}
      hoverStyle={{ bg: active ? '$color5' : '$color3' }}
    >
      <ProductIcon icon={Icon} color={color} size={24} />
      <YStack flex={1}>
        <Text fontSize="$3" fontWeight="600" color="$color12">
          {entry.label}
        </Text>
        <Text fontSize="$1" color="$color10">
          {entry.category}
          {entry.gcp ? ` · ${entry.gcp}` : ''}
        </Text>
      </YStack>
      {entry.admin ? <Lock size={13} opacity={0.45} /> : null}
      {onPin ? <PinToggle label={entry.label} pinned={pinned === true} active={active} onPress={onPin} /> : null}
      <ArrowRight size={13} opacity={active ? 0.8 : 0.3} />
    </XStack>
  )
}

/**
 * A ⌘K result — a product (via CatalogRow) or a deep sub-page jump.
 *
 * Only PRODUCTS carry a pin: the pin model keys on a product id, so pinning a
 * sub-page would either silently pin its parent (a lie about what you clicked) or
 * need a second pin model. One model, so sub-pages simply don't offer the control.
 */
function DestinationRow({
  dest,
  active,
  colorOf,
  pinned,
  onPin,
  onPress,
}: {
  dest: Destination
  active: boolean
  colorOf: (id: string) => string
  pinned?: boolean
  onPin?: () => void
  onPress: () => void
}) {
  if (dest.kind === 'product')
    return (
      <CatalogRow
        entry={dest.entry}
        active={active}
        color={colorOf(dest.entry.id)}
        pinned={pinned}
        onPin={onPin}
        onPress={onPress}
      />
    )
  const { entry, subpage } = dest
  const Icon = subpage.icon ?? entry.icon
  return (
    <XStack
      onPress={onPress}
      cursor="pointer"
      items="center"
      gap="$3"
      px="$3"
      py="$2.5"
      rounded="$3"
      id={active ? 'cmdk-active' : undefined}
      bg={active ? '$color5' : 'transparent'}
      hoverStyle={{ bg: active ? '$color5' : '$color3' }}
    >
      <Icon size={17} color={asColor(colorOf(entry.id))} />
      <YStack flex={1}>
        <Text fontSize="$3" fontWeight="600" color="$color12">
          {entry.label} › {subpage.label}
        </Text>
        <Text fontSize="$1" color="$color10">
          {entry.category} · {entry.label}
        </Text>
      </YStack>
      <ArrowRight size={13} opacity={active ? 0.8 : 0.3} />
    </XStack>
  )
}

/** Stable key for a destination (product id, or `id/slug` for a sub-page). */
const destKey = (d: Destination): string => (d.kind === 'product' ? d.entry.id : `${d.entry.id}/${d.subpage.slug}`)

function ActionRow({
  action,
  active,
  onPress,
}: {
  action: PaletteAction
  active: boolean
  onPress: () => void
}) {
  const Icon = action.icon
  return (
    <XStack
      onPress={onPress}
      cursor="pointer"
      items="center"
      gap="$3"
      px="$3"
      py="$2.5"
      rounded="$3"
      id={active ? 'cmdk-active' : undefined}
      bg={active ? '$color5' : 'transparent'}
      hoverStyle={{ bg: active ? '$color5' : '$color3' }}
    >
      <Icon size={17} />
      <YStack flex={1}>
        <Text fontSize="$3" fontWeight="600" color="$color12">
          {action.label}
        </Text>
        <Text fontSize="$1" color="$color10">
          {action.hint}
        </Text>
      </YStack>
      <CornerDownLeft size={13} opacity={active ? 0.8 : 0.3} />
    </XStack>
  )
}

/** A small uppercase section label inside the palette result list. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text px="$3" pt="$2" pb="$1" fontSize="$1" color="$color10" fontWeight="500">
      {children}
    </Text>
  )
}

function PaletteDialog({
  open,
  seed,
  onOpenChange,
}: {
  open: boolean
  seed: string
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const { signOut } = useSession()
  const showAdmin = useIsSuperAdmin()
  const showBeta = useAppsBeta(showAdmin)
  const { colorOf } = useProductColors()
  const pins = usePins()
  const { current, resolvedTheme, set: setTheme } = useThemeSetting()
  const isDark = (resolvedTheme ?? current ?? 'dark') !== 'light'
  const [query, setQuery] = useState(seed)
  const [sel, setSel] = useState(0)
  const [run, setRun] = useState<RunState>({ status: 'idle' })
  const [orgs, setOrgs] = useState<Organization[]>([])

  const mode: Mode = query.startsWith('>') ? 'ai' : query.startsWith('?') ? 'help' : 'catalog'
  const sub = (mode === 'catalog' ? query : query.slice(1)).trim()

  // The org list powers the "Switch to <org>" actions. Only an admin who can see
  // more than one org gets switch actions; everyone else just gets the verbs. The
  // list comes from the cross-tenant `/admin/iam/get-organizations?owner=admin`
  // aggregate, which is server-gated to global admins — so don't fire it for a tenant
  // user (it only 403s); they just get the verbs, no switch actions.
  useEffect(() => {
    if (!open || !showAdmin) return
    let live = true
    IamAdminApi.organizations()
      .then((p) => {
        if (live) setOrgs(p.rows ?? [])
      })
      .catch(() => {
        if (live) setOrgs([])
      })
    return () => {
      live = false
    }
  }, [open, showAdmin])

  // Every command the palette can RUN (verbs + per-org switches). Composed from the
  // same pieces the chrome uses (router, theme, session, org scope) — no
  // dead entries: each `run` is wired.
  const actions = useMemo<PaletteAction[]>(() => {
    const cur = currentOrg()
    const verbs: PaletteAction[] = [
      { id: 'home', label: 'Go to Overview', hint: 'Dashboard home', keywords: 'home start dashboard root overview', icon: House, run: () => { onOpenChange(false); router.push('/') } },
      { id: 'apps', label: 'Show all apps', hint: 'Browse every product', keywords: 'browse grid all products everything apps', icon: LayoutGrid, run: () => setQuery('') },
      { id: 'settings', label: 'Open Settings', hint: 'Account, organization, branding', keywords: 'preferences account profile settings', icon: SlidersHorizontal, run: () => { onOpenChange(false); router.push('/settings') } },
      { id: 'theme', label: isDark ? 'Switch to light theme' : 'Switch to dark theme', hint: 'Toggle appearance', keywords: 'dark light appearance theme mode color', icon: isDark ? Sun : Moon, run: () => setTheme(isDark ? 'light' : 'dark') },
      { id: 'ai', label: 'Ask AI', hint: 'Find or do something with AI', keywords: 'assistant zen gpt ask question ai', icon: Sparkles, run: () => setQuery('> ') },
      { id: 'docs', label: 'Search the docs', hint: 'Ask the documentation', keywords: 'help docs documentation manual guide', icon: Zap, run: () => setQuery('? ') },
      { id: 'signout', label: 'Sign out', hint: 'End your session', keywords: 'logout sign out exit leave', icon: LogOut, run: () => { onOpenChange(false); void signOut() } },
    ]
    const orgVerbs: PaletteAction[] = orgs
      .filter((o) => o.name !== cur)
      .map((o) => ({
        id: `org:${o.name}`,
        label: `Switch to ${o.displayName || titleCase(o.name)}`,
        hint: 'Switch organization',
        keywords: `org organization tenant switch ${o.name}`,
        icon: Building2,
        run: () => switchOrg(o.name),
      }))
    return [...verbs, ...orgVerbs]
  }, [isDark, orgs, router, signOut, setTheme, onOpenChange])

  // Every jump target — products AND deep sub-pages ("queues" → Tasks › Queues).
  // ⌘K is a DISCOVERY surface: it jumps to the WHOLE catalog (admin-gated only), NOT
  // the org's entitled scope — entitlement governs the sidebar + product use, never
  // what you can find/jump to. Admin-only operator surfaces stay gated by `showAdmin`.
  //
  // PINS ORDER THE DEFAULT VIEW; TYPING ORDERS ITSELF. With no query the list is the
  // user's own — their pinned products lead, in their own pin order, exactly as the
  // sidebar's Pinned section does. The moment they type, RELEVANCE decides and pins
  // step aside.
  //
  // That split is not fussiness, it is a bug this cost: floating pins over a ranked
  // query meant a barely-matching pinned product outranked an exact name match, and
  // typing "billing" + ↵ opened Models. A search that ignores what you typed is not
  // a search, so the ranked branch is left strictly alone.
  const destResults = useMemo(() => {
    if (mode !== 'catalog') return []
    const found = searchDestinations(query, showAdmin, null, showBeta)
    if (sub) return found.slice(0, 50)
    return pinnedFirst(found, (d) => (d.kind === 'product' ? d.entry.id : ''), pins.pinnedIds)
  }, [mode, query, sub, showAdmin, pins.pinnedIds])

  const matchedActions = useMemo(
    () => (mode === 'catalog' && sub ? actions.filter((a) => actionMatches(a, sub.toLowerCase())) : []),
    [mode, sub, actions],
  )

  // One ordered list (actions first, then destinations) so ↑/↓/↵ traverse both.
  type Item = { kind: 'action'; action: PaletteAction } | { kind: 'dest'; dest: Destination }
  const items = useMemo<Item[]>(
    () => [
      ...matchedActions.map((action) => ({ kind: 'action' as const, action })),
      ...destResults.map((dest) => ({ kind: 'dest' as const, dest })),
    ],
    [matchedActions, destResults],
  )

  // Empty query is the Apps browse state: the same destinations, grouped for scan
  // speed. Typing switches to one ranked list without opening a second overlay.
  //
  // Pinned products already lead `destResults`, so labelling them by "Pinned"
  // rather than their category collects them into ONE leading section — the same
  // section, in the same order, under the same word the sidebar uses.
  const browseGroups = useMemo(() => {
    if (mode !== 'catalog' || sub) return []
    const groups: { category: string; rows: { dest: Destination; index: number }[] }[] = []
    destResults.forEach((dest, index) => {
      const category =
        dest.kind === 'product' && pins.isPinned(dest.entry.id) ? DEFAULT_GROUP_LABEL : dest.entry.category
      const last = groups[groups.length - 1]
      if (last?.category === category) last.rows.push({ dest, index })
      else groups.push({ category, rows: [{ dest, index }] })
    })
    return groups
  }, [mode, sub, destResults, pins])

  // Seed the query each time the palette opens.
  useEffect(() => {
    if (open) setQuery(seed)
  }, [open, seed])

  // A new query resets selection + any prior AI run.
  useEffect(() => {
    setSel(0)
    setRun({ status: 'idle' })
  }, [query])

  const activate = useCallback(
    (entry: CatalogEntry) => {
      onOpenChange(false)
      openProduct(entry, (p) => router.push(p))
    },
    [onOpenChange, router],
  )

  /** Activate a destination — a product (open) or a sub-page (navigate deep). */
  const activateDest = useCallback(
    (dest: Destination) => {
      onOpenChange(false)
      if (dest.kind === 'subpage') router.push(dest.path)
      else openProduct(dest.entry, (p) => router.push(p))
    },
    [onOpenChange, router],
  )

  /**
   * Pin/unpin a destination WITHOUT closing — curating is a repeated act, and an
   * overlay that dismisses itself after each one would make pinning five products
   * five round trips. A sub-page has no pin (see `DestinationRow`), so it no-ops.
   */
  const togglePin = useCallback(
    (dest: Destination) => {
      if (dest.kind === 'product') pins.toggle(dest.entry.id)
    },
    [pins],
  )

  const submit = useCallback(async () => {
    if (!sub) return
    setRun({ status: 'loading' })
    try {
      if (mode === 'ai') {
        // Same grounded expert prompt as the chat, plus the nav contract: a clear
        // "open X" jumps to the product; anything else gets a real, accurate answer.
        const ans = (await AiApi.chat({ question: sub, system: commandBarSystemPrompt({ showAdmin }) })).trim()
        const m = ans.match(/^NAV\s+([a-z0-9-]+)/i)
        const entry = m ? findEntry(m[1]) : undefined
        if (entry) setRun({ status: 'nav', entry })
        else setRun({ status: 'text', text: ans })
      } else {
        // Docs mode: retrieval grounded in the same expert context.
        const ans = await AiApi.ragChat({
          question: sub,
          store: 'docs',
          system: hanzoAssistantSystemPrompt({ showAdmin }),
        })
        setRun({ status: 'text', text: ans })
      }
    } catch (e) {
      setRun({ status: 'error', state: assistantState(e) })
    }
  }, [mode, sub, showAdmin])

  // Keyboard while open: ↑/↓ select, ↵ activate/ask, Esc close.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
        return
      }
      if (mode === 'catalog') {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSel((s) => Math.min(s + 1, Math.max(items.length - 1, 0)))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSel((s) => Math.max(s - 1, 0))
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const it = items[sel]
          if (!it) return
          // ⌥↵ is the secondary verb on the selection: keep this, stay here.
          // ↵ is the primary: go there. Same key, one modifier apart, so the
          // pair is learnable from the legend without a second shortcut to know.
          if (e.altKey) {
            if (it.kind === 'dest') togglePin(it.dest)
            return
          }
          if (it.kind === 'action') it.action.run()
          else activateDest(it.dest)
        }
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (run.status === 'loading') return
        if (run.status === 'nav') activate(run.entry)
        else void submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, mode, items, sel, run, submit, activate, activateDest, togglePin, onOpenChange])

  // Keep the ↑/↓-selected row visible: as selection moves past the fold, scroll
  // the active row into view (the list can hold 50 results — well beyond 560px).
  useEffect(() => {
    if (!open || mode !== 'catalog' || typeof document === 'undefined') return
    document.getElementById('cmdk-active')?.scrollIntoView({ block: 'nearest' })
  }, [sel, open, mode])

  const placeholder =
    mode === 'ai'
      ? 'Ask AI to find or do something…'
      : mode === 'help'
        ? 'Ask the docs…'
        : 'Search apps and commands…'

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay key="palette-overlay" className="hz-scrim-in" bg="rgba(0,0,0,0.5)" />
        {/* Full-screen on mobile (fills the viewport, reachable from the mobile
            menu); a floating 640 box at lg+ on Material paper (real depth). */}
        <Dialog.Content
          key="palette-content"
          className="hz-paper hz-pop-in"
          bordered
          width="100vw"
          height="100dvh"
          maxW="100vw"
          rounded="$0"
          $lg={{ width: 640, height: 'auto', maxW: '90%', rounded: '$6' }}
          p="$0"
          gap="$0"
          overflow="hidden"
        >
          <VisuallyHidden>
            <Dialog.Title>Apps and commands</Dialog.Title>
          </VisuallyHidden>

          {/* Query row */}
          <XStack items="center" gap="$2.5" px="$3.5" py="$3" borderBottomWidth={1} borderColor="$borderColor">
            {mode === 'ai' ? (
              <Sparkles size={18} opacity={0.7} />
            ) : (
              <Search size={18} opacity={0.7} />
            )}
            <Input
              flex={1}
              unstyled
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={placeholder}
              fontSize="$4"
              color="$color12"
              // `unstyled` still leaves Gui's own 3px base radius, which belongs to
              // no scale and is visible as a faint rounding inside the palette's
              // own 12px panel. A field that fills its container is flat.
              rounded="$0"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <XStack items="center" gap="$1" opacity={0.5}>
              <Text fontSize="$1" color="$color10">
                esc
              </Text>
            </XStack>
          </XStack>

          {/* Body — fills the viewport on mobile; a stable, tall box at lg+ so
              the palette reads as a real command surface (Raycast/Linear-style)
              instead of collapsing to a two-row sliver when few results match. */}
          <YStack flex={1} minH={0} overflow="hidden" $lg={{ flex: 0, minH: 340, maxH: 560 }}>
            {mode === 'catalog' ? (
              items.length === 0 ? (
                <YStack p="$5" items="center">
                  <Text color="$color10">No commands or products match “{sub}”.</Text>
                </YStack>
              ) : (
                <ScrollView flex={1} p="$2" showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
                  {browseGroups.length > 0 ? (
                    <YStack gap="$2">
                      {browseGroups.map((group) => (
                        <YStack key={group.category} gap="$0.5">
                          <SectionLabel>{group.category}</SectionLabel>
                          <XStack flexWrap="wrap">
                            {group.rows.map(({ dest, index }) => (
                              <YStack key={destKey(dest)} width="100%" $lg={{ width: '50%' }} px="$0.5">
                                <DestinationRow
                                  dest={dest}
                                  active={index === sel}
                                  colorOf={colorOf}
                                  pinned={dest.kind === 'product' && pins.isPinned(dest.entry.id)}
                                  onPin={dest.kind === 'product' ? () => togglePin(dest) : undefined}
                                  onPress={() => activateDest(dest)}
                                />
                              </YStack>
                            ))}
                          </XStack>
                        </YStack>
                      ))}
                    </YStack>
                  ) : (
                    <YStack gap="$0.5">
                      {matchedActions.length > 0 ? <SectionLabel>Actions</SectionLabel> : null}
                      {matchedActions.map((action, i) => (
                        <ActionRow key={`action-${action.id}`} action={action} active={i === sel} onPress={action.run} />
                      ))}
                      {destResults.length > 0 && matchedActions.length > 0 ? <SectionLabel>Go to</SectionLabel> : null}
                      {destResults.map((dest, j) => {
                        const i = matchedActions.length + j
                        return (
                          <DestinationRow
                            key={destKey(dest)}
                            dest={dest}
                            active={i === sel}
                            colorOf={colorOf}
                            pinned={dest.kind === 'product' && pins.isPinned(dest.entry.id)}
                            onPin={dest.kind === 'product' ? () => togglePin(dest) : undefined}
                            onPress={() => activateDest(dest)}
                          />
                        )
                      })}
                    </YStack>
                  )}
                </ScrollView>
              )
            ) : (
              <YStack p="$4" gap="$3">
                {run.status === 'idle' ? (
                  <XStack gap="$2" items="center">
                    <CornerDownLeft size={15} opacity={0.6} />
                    <Text color="$color10" fontSize="$3">
                      {mode === 'ai'
                        ? 'Press ↵ to ask AI to find a product or answer.'
                        : 'Press ↵ to search the docs.'}
                    </Text>
                  </XStack>
                ) : run.status === 'loading' ? (
                  <XStack gap="$2.5" items="center">
                    <Spinner color="$color11" />
                    <Text color="$color11" fontSize="$3">
                      {mode === 'ai' ? 'Thinking…' : 'Searching the docs…'}
                    </Text>
                  </XStack>
                ) : run.status === 'nav' ? (
                  <CatalogRow entry={run.entry} active color={colorOf(run.entry.id)} onPress={() => activate(run.entry)} />
                ) : run.status === 'text' ? (
                  <Answer text={run.text} />
                ) : (
                  <BackendStateCard state={run.state} onRetry={() => void submit()} />
                )}
              </YStack>
            )}
          </YStack>

          {/* Legend */}
          <XStack
            px="$3.5"
            py="$2"
            gap="$3"
            borderTopWidth={1}
            borderColor="$borderColor"
            bg="$color1"
            flexWrap="wrap"
          >
            <Legend keys="↑↓" label="navigate" />
            <Legend keys="↵" label="open" />
            <Legend keys="⌥↵" label="pin" />
            <Legend keys=">" label="AI" />
            <Legend keys="?" label="docs" />
            <XStack flex={1} />
            <XStack
              onPress={() => setQuery('')}
              cursor="pointer"
              items="center"
              gap="$1.5"
              opacity={0.8}
              hoverStyle={{ opacity: 1 }}
            >
              <LayoutGrid size={13} />
              <Text fontSize="$1" color="$color11" fontWeight="600">
                {sub ? 'All apps' : `${destResults.length} apps`}
              </Text>
            </XStack>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

function Legend({ keys, label }: { keys: string; label: string }) {
  return (
    <XStack items="center" gap="$1.5" opacity={0.6}>
      <Text fontSize="$1" color="$color12" fontWeight="700">
        {keys}
      </Text>
      <Text fontSize="$1" color="$color10">
        {label}
      </Text>
    </XStack>
  )
}

export function Palette({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [seed, setSeed] = useState('')

  const open = useCallback(() => {
    setSeed('')
    setIsOpen(true)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  // ⌘K / Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setSeed('')
        setIsOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Ctx.Provider value={{ isOpen, open, close }}>
      {children}
      <PaletteDialog open={isOpen} seed={seed} onOpenChange={setIsOpen} />
    </Ctx.Provider>
  )
}

/** Header trigger — a search box that opens the palette. */
export function CommandSearchBox() {
  const { open } = useCommandPalette()
  return (
    <XStack
      onPress={open}
      cursor="pointer"
      items="center"
      gap="$2"
      px="$3"
      height={36}
      flex={1}
      maxW={420}
      bg="$color2"
      borderWidth={1}
      borderColor="$borderColor"
      rounded="$4"
      hoverStyle={{ borderColor: '$color8' }}
    >
      <Search size={15} opacity={0.6} />
      <Text flex={1} fontSize="$3" color="$color10" numberOfLines={1}>
        Search or jump to…
      </Text>
      {/* ⌘K hint — hidden below lg: there is no keyboard shortcut on a phone, and
          the chip stole width from the placeholder (which truncated to “S…”). */}
      <XStack display="none" $lg={{ display: 'flex' }} items="center" gap="$1" opacity={0.6}>
        <Command size={12} />
        <Text fontSize="$2" color="$color10">
          K
        </Text>
      </XStack>
    </XStack>
  )
}
