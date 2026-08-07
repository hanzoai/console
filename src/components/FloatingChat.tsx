'use client'

/**
 * AI chat — one assistant surface, TWO shapes (the user picks, and it persists):
 *
 *  - FLOATING (default): a bubble fixed bottom-right on every dashboard page; tap it
 *    to open a compact popover (desktop) or a full-screen sheet (phone/tablet). The
 *    assistant is one tap away from any view.
 *  - DOCKED-RIGHT: a PERMANENT right-hand column (desktop/laptop) that reserves its
 *    own space beside the content — a classic docked panel. Toggle floating ⇄ docked
 *    from either header. The docked column is rendered by `Dashboard`
 *    (`DockedChatPanel`), which reserves the layout width; this module owns the
 *    dock STATE (persisted per-user via `usePreferences` under `chatDocked`) + the
 *    floating bubble/sheet.
 *
 * Docking is a desktop concern (a phone has no room for a permanent column), so on
 * `<lg` the assistant is ALWAYS the floating bubble/sheet regardless of the dock
 * choice. That fact — the persisted CHOICE against a viewport that can honor it —
 * meets in exactly one place, `column`, and it is what every shape is chosen by.
 *
 * It is not a detail. The sheet is a MODAL dialog, so leaving it open behind a hidden
 * column put a full-viewport dialog over the page: the column painted, and every click
 * on it landed on the dialog instead — an assistant you could read and could not type
 * into. Hiding one of two open surfaces with CSS cannot fix that, because `display:
 * none` on the dialog's own content does not make the dialog stop being modal. So only
 * one is ever open, and `column` is the one fact that says which.
 *
 * The assistant has ONE entry point and it lives HERE: `AssistantFab`, a floating
 * control fixed bottom-right over every dashboard page. It used to be two small
 * buttons in the topbar (a brand-H and a mic), which put the assistant in a third
 * place — beside the search box, competing with the org/theme/alert chrome — while
 * this module owned every other shape it can take. Chat and voice are the same
 * surface opened two ways, so they sit together, in the corner the assistant
 * actually appears in.
 *
 * Every shape REUSES the one working chat surface (`ChatConversation` → `AiApi.chat`
 * → the keyless `/ai` proxy → /v1/chat/completions). Nothing about AI is rebuilt
 * here; this is purely the container. "History" deep-links to the full `/chat` page.
 *
 * Mounted once in the dashboard layout, so a single instance serves all children.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button, Dialog, Text, VisuallyHidden, XStack, YStack, useMedia } from '@hanzo/gui'
import { Mic, PanelRight, PanelRightClose, Sparkles, X } from '@hanzogui/lucide-icons-2'

import { ChatConversation } from '~/components/products/chat/ChatConversation'
import { BrandMark } from '~/components/ui/BrandLogo'
import { usePreferences } from '~/lib/products/preferences'
import { voiceSupported } from '~/lib/voice'
import { Z } from '~/lib/z'

type FloatingChatApi = {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  /**
   * True when the permanent right column IS the assistant right now: the dock choice,
   * a viewport wide enough to hold it, and a page that is not already a composer.
   * Every surface reads this rather than the raw choice, so exactly one composer is
   * on screen at any width.
   */
  column: boolean
  setDocked: (v: boolean) => void
  /**
   * Open the assistant with a PRE-FILLED prompt (e.g. "Ask AI about this code" from the
   * Code hub). The composer is seeded and focused; the user reviews and sends (never an
   * auto-send — no surprise billing), matching the suggested-prompt UX. The column takes
   * the seed when it is the assistant; otherwise the sheet opens with it.
   */
  ask: (prompt: string) => void
  /** The current pending seed for the composer (consumed once by the active conversation). */
  seed: string | null
  /** Open the assistant as the right sidebar (docked column) on desktop, or the
   *  full sheet on phones — the topbar brand-H entry. Toggles. */
  openChat: () => void
  /** Open the assistant AND start listening — "talk to Hanzo" (the topbar mic). */
  startVoice: () => void
  /** Monotonic voice-start signal; the active conversation opens the mic when it
   *  changes (each `startVoice` increments it). */
  voiceSignal: number
}

const Ctx = createContext<FloatingChatApi | null>(null)

/** Open/close/dock the assistant from anywhere (e.g. an empty-state CTA). */
export function useFloatingChat(): FloatingChatApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useFloatingChat must be used within <Chat>')
  return ctx
}

/** The shared assistant header — title + (dock/undock) + a trailing control. */
function AssistantHeader({
  onDockToggle,
  docked,
  trailing,
}: {
  onDockToggle: () => void
  docked: boolean
  trailing?: ReactNode
}) {
  return (
    <XStack
      items="center"
      justify="space-between"
      px="$3"
      py="$2.5"
      borderBottomWidth={1}
      borderColor="$borderColor"
      bg="$color2"
    >
      <XStack items="center" gap="$2" minW={0}>
        <Sparkles size={16} opacity={0.8} />
        <Text fontSize="$4" fontWeight="700" color="$color12" numberOfLines={1}>
          Assistant
        </Text>
      </XStack>
      <XStack items="center" gap="$1">
        <Button
          size="$2"
          chromeless
          icon={docked ? <PanelRightClose size={17} /> : <PanelRight size={17} />}
          onPress={onDockToggle}
          aria-label={docked ? 'Undock — float the assistant' : 'Dock the assistant to the right'}
        />
        {trailing}
      </XStack>
    </XStack>
  )
}

function ChatSheet({
  open,
  onOpenChange,
  onHistory,
  onDock,
  seed,
  voiceSignal,
}: {
  /** Open ONLY when the sheet is the assistant — never alongside the column. */
  open: boolean
  onOpenChange: (o: boolean) => void
  onHistory: () => void
  onDock: () => void
  /** Pre-fill seed for the composer (from `useFloatingChat().ask`). */
  seed?: string | null
  /** Voice-start signal forwarded to the conversation ("talk to Hanzo"). */
  voiceSignal?: number
}) {
  // Size is CSS-driven (media props), not a JS branch: base = mobile full-bleed
  // sheet; `$lg` = a compact popover pinned bottom-right. The scrim dims the page
  // on mobile and goes transparent on desktop (popover, no full-screen dim).
  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay key="chat-overlay" className="hz-scrim-in" bg="rgba(0,0,0,0.5)" $lg={{ bg: 'transparent' }} />
        <Dialog.Content
          key="chat-content"
          className="hz-paper hz-pop-in"
          bordered
          position="absolute"
          bg="$color1"
          overflow="hidden"
          p="$0"
          // Mobile/tablet: full-bleed.
          t={0}
          l={0}
          r={0}
          b={0}
          width="100vw"
          height="100dvh"
          rounded="$0"
          // Desktop (≥lg): a compact popover bottom-right, above the bubble.
          $lg={{ t: 'auto', l: 'auto', b: 88, r: 24, width: 380, height: 560, rounded: '$6' }}
        >
          <VisuallyHidden>
            <Dialog.Title>Assistant</Dialog.Title>
          </VisuallyHidden>

          <YStack flex={1} minH={0}>
            <AssistantHeader
              docked={false}
              onDockToggle={onDock}
              trailing={
                <Button
                  size="$2"
                  chromeless
                  minW={44}
                  minH={44}
                  $lg={{ minW: 0, minH: 0 }}
                  icon={<X size={18} />}
                  onPress={() => onOpenChange(false)}
                  aria-label="Close assistant"
                />
              }
            />

            {/* The ONE working conversation, given a flex container to fill. */}
            <YStack flex={1} minH={0} p="$3">
              <ChatConversation compact seed={seed ?? undefined} voiceSignal={voiceSignal} onShowHistory={onHistory} />
            </YStack>
          </YStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

/**
 * The floating assistant control — bottom-right, on every dashboard page.
 *
 * Two ways into one surface, side by side: the brand mark opens the assistant (the
 * docked right column on a laptop, the full sheet on a phone) and the mic opens it
 * listening. The mic renders only where the browser can actually listen, so there is
 * never a dead control.
 *
 * It is the assistant's entry point on phones/tablets (`<lg`). At `lg+` the
 * Developers dock at the foot of the page hosts the same mic + brand-mark, so the
 * bubble is hidden there (`$lg` display:none) — one launcher per viewport, never two.
 * Its caller also suppresses it where the assistant is already on screen: while the
 * sheet is open, on the pages that ARE a composer (`/chat`, `/playground`), and while
 * the assistant IS the column.
 */
function AssistantFab({ onOpen, onVoice }: { onOpen: () => void; onVoice: () => void }) {
  const [voiceOk] = useState(() => voiceSupported())
  return (
    <XStack
      testID="assistant-fab"
      position="fixed"
      r={20}
      b={20}
      $lg={{ display: 'none' }}
      items="center"
      gap="$2"
      style={{ zIndex: Z.raised }}
    >
      {voiceOk ? (
        <Button
          className="hz-paper"
          size="$3"
          circular
          width={44}
          height={44}
          bg="$color2"
          borderWidth={1}
          borderColor="$borderColor"
          icon={<Mic size={18} />}
          onPress={onVoice}
          aria-label="Talk to Hanzo"
        />
      ) : null}
      <Button
        className="hz-paper"
        size="$4"
        circular
        width={52}
        height={52}
        bg="$color2"
        borderWidth={1}
        borderColor="$borderColor"
        icon={<BrandMark size={22} />}
        onPress={onOpen}
        aria-label="Ask Hanzo"
      />
    </XStack>
  )
}

/**
 * The DOCKED assistant — a permanent right column. Rendered by `Dashboard`
 * inside the layout's reserved right rail (lg+ only), so it reserves space beside
 * the content instead of floating over it. Undock returns to the floating bubble.
 */
export function DockedChatPanel() {
  const router = useRouter()
  const { setDocked, seed, voiceSignal } = useFloatingChat()
  const onHistory = useCallback(() => router.push('/chat'), [router])
  return (
    <YStack flex={1} minH={0} bg="$color1">
      <AssistantHeader docked onDockToggle={() => setDocked(false)} />
      <YStack flex={1} minH={0} p="$3">
        <ChatConversation compact seed={seed ?? undefined} voiceSignal={voiceSignal} onShowHistory={onHistory} />
      </YStack>
    </YStack>
  )
}

export function Chat({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const { get, set } = usePreferences()
  const docked = get<boolean>('chatDocked', false)
  const setDocked = useCallback((v: boolean) => set('chatDocked', v), [set])
  const media = useMedia()
  // The pages that ARE a full composer already show the assistant, so no other shape
  // of it belongs on them — the bubble would overlap the page's own send control, and
  // the column would be a second composer beside the first.
  const onChatSurface =
    pathname === '/chat' ||
    pathname.startsWith('/chat/') ||
    pathname === '/playground' ||
    pathname.startsWith('/playground/')
  // Every fact about which shape the assistant takes meets here and nowhere else: the
  // persisted choice, a viewport wide enough to honor it, and whether this page is
  // already a composer. A JS fact, not a media prop, because it decides what MOUNTS —
  // a modal dialog that is merely hidden is still modal, and still eats every click.
  const column = docked && media.lg && !onChatSurface
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((v) => !v), [])

  // Seed the composer from anywhere (e.g. the Code hub's "Ask AI about this code").
  // The column is already on screen and receives the seed; otherwise open the sheet —
  // including on a phone whose owner once docked on a laptop, where the choice is
  // remembered but no column exists to deliver the prompt.
  const [seed, setSeed] = useState<string | null>(null)
  const ask = useCallback(
    (prompt: string) => {
      setSeed(prompt)
      if (!column) setIsOpen(true)
    },
    [column],
  )

  const onHistory = useCallback(() => {
    setIsOpen(false)
    router.push('/chat')
  }, [router])

  // Dock from the floating sheet: reserve the desktop column + close the popover.
  const dock = useCallback(() => {
    setDocked(true)
    setIsOpen(false)
  }, [setDocked])

  // Voice-start signal — each "talk to Hanzo" click increments it; the active
  // conversation opens the mic on change.
  const [voiceSignal, setVoiceSignal] = useState(0)

  // The topbar brand-H entry: TOGGLE the assistant. Desktop → the right column;
  // phones (no column) → the full sheet. Both are set because `column` then admits
  // exactly one of them per viewport.
  const openChat = useCallback(() => {
    const next = !docked
    setDocked(next)
    setIsOpen(next)
  }, [docked, setDocked])

  // The topbar mic: OPEN the assistant (sidebar on desktop / sheet on phones) and
  // start listening.
  const startVoice = useCallback(() => {
    setDocked(true)
    setIsOpen(true)
    setVoiceSignal((n) => n + 1)
  }, [setDocked])

  return (
    <Ctx.Provider value={{ isOpen, open, close, toggle, column, setDocked, ask, seed, openChat, startVoice, voiceSignal }}>
      {children}

      {/* The assistant's ONE entry point — bottom-right, over every page. Hidden
          while the sheet is open (its own close is the single dismiss), on the pages
          that ARE a composer, and while the column is the surface. `open`/`toggle`/
          `ask` still drive the assistant programmatically (e.g. "Ask AI"). */}
      {isOpen || onChatSurface || column ? null : <AssistantFab onOpen={openChat} onVoice={startVoice} />}

      {/* The floating sheet — the assistant wherever the column is not: every width on
          a phone or tablet, and on a laptop until the user docks it. Never open at the
          same time as the column, so there is one composer and it takes the click. */}
      <ChatSheet
        open={isOpen && !onChatSurface && !column}
        onOpenChange={setIsOpen}
        onHistory={onHistory}
        onDock={dock}
        seed={seed}
        voiceSignal={voiceSignal}
      />
    </Ctx.Provider>
  )
}
