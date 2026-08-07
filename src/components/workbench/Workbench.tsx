'use client'

/**
 * Workbench — the persistent Developers dock at the FOOT of the dashboard (the
 * developer-workbench pattern): a slim always-there bar ("Developers" + a `$` prompt
 * + quick icons) that expands into a bottom drawer of developer tabs, available on
 * EVERY page without leaving it. Desktop-only (lg+ — a pointer-density concern);
 * open state persists per-user via the ONE preferences store.
 *
 * The full developer tab set — each org-scoped, wired to REAL Hanzo data (or an
 * honest empty/coming/runtime state), each mounted only while active (lazy):
 *
 *  - Overview  — integration snapshot: request volume + error rate + tokens/spend
 *    (charged ledger), the account's Cloud API key, the API version + dev-resource
 *    links (docs · reference · SDKs · CLI).
 *  - Logs      — the recent charged API calls, filterable, row → JSON detail.
 *  - Events    — the platform-event stream projected from the same real ledger.
 *  - Webhooks  — a read-only live glance at the org's endpoints that deep-links into
 *    the full Webhooks product (which owns config/security/test/logs CRUD).
 *  - Health    — Alerts · Errors · Insights from the o11y runtime.
 *  - Inspector — fetch any object by id (agent_… / fn_… / a resource path) → JSON.
 *  - Traces    — the existing TracesModule (LLM/agent traces), embedded.
 *  - Shell     — a read-only /v1 explorer with a resource picker + show-code.
 *
 * The ledger-backed tabs (Overview/Logs/Events) share the ONE usage fetch owned
 * here; the heavier tabs load their own data on selection. Command parsing + the
 * id router live in the pure `./logic` (tested).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, ScrollView, Text, XStack, YStack } from '@hanzo/gui'
import {
  Activity,
  Maximize2,
  Mic,
  Minimize2,
  RefreshCw,
  ScrollText,
  SquareTerminal,
  X,
} from '@hanzogui/lucide-icons-2'

import { fetchUsageRecords, type UsageRecord } from '~/lib/api/aimetrics'
import { usePreferences } from '~/lib/products/preferences'
import { useFloatingChat } from '~/components/FloatingChat'
import { BrandMark } from '~/components/ui/BrandLogo'
import { voiceSupported } from '~/lib/voice'
import {
  EventsTab,
  HealthTab,
  InspectorTab,
  LogsTab,
  OverviewTab,
  ShellTab,
  TracesTab,
  WebhooksTab,
} from './tabs'

type TabId = 'overview' | 'logs' | 'events' | 'webhooks' | 'health' | 'inspector' | 'traces' | 'shell'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'logs', label: 'Logs' },
  { id: 'events', label: 'Events' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'health', label: 'Health' },
  { id: 'inspector', label: 'Inspector' },
  { id: 'traces', label: 'Traces' },
  { id: 'shell', label: 'Shell' },
]

/** The tabs that read the shared usage ledger (loaded once, here). */
const LEDGER_TABS: ReadonlySet<TabId> = new Set<TabId>(['overview', 'logs', 'events', 'inspector'])

export function WorkbenchDock() {
  const router = useRouter()
  const { get, set } = usePreferences()
  // The assistant lives in this bar on desktop (the floating bubble is suppressed
  // at lg+). The mic starts it listening; the brand mark opens it.
  const { openChat, startVoice } = useFloatingChat()
  const [voiceOk] = useState(() => voiceSupported())
  const open = get<boolean>('workbenchOpen', false)
  const [tab, setTab] = useState<TabId>('overview')
  // Freely resizable dock height (px), persisted per-user — drag the top handle to
  // ANY height; the maximize button is a quick tall/compact preset.
  const [height, setHeight] = useState<number>(() => get<number>('workbenchHeight', 380))
  const heightRef = useRef(height)
  heightRef.current = height
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const [records, setRecords] = useState<UsageRecord[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setRecords(await fetchUsageRecords())
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  // Load the ledger the first time it is needed (dock opened onto a ledger tab).
  useEffect(() => {
    if (open && LEDGER_TABS.has(tab) && records === null && !loading) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab])

  const openTo = (t: TabId) => {
    setTab(t)
    if (!open) set('workbenchOpen', true)
  }
  const go = (path: string) => {
    router.push(path)
    set('workbenchOpen', false)
  }

  // Drag-to-resize: grab the top handle and drag to any height; the final height
  // persists per-user on release. Bounded [200px, 90vh].
  const onDrag = useCallback((e: MouseEvent) => {
    const d = dragRef.current
    if (!d) return
    const max = typeof window !== 'undefined' ? window.innerHeight * 0.9 : 900
    setHeight(Math.max(200, Math.min(max, d.startH + (d.startY - e.clientY))))
  }, [])
  const endDrag = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('mousemove', onDrag)
    window.removeEventListener('mouseup', endDrag)
    set('workbenchHeight', Math.round(heightRef.current))
  }, [onDrag, set])
  const startDrag = useCallback(
    (e: { clientY: number; preventDefault: () => void }) => {
      e.preventDefault()
      dragRef.current = { startY: e.clientY, startH: heightRef.current }
      window.addEventListener('mousemove', onDrag)
      window.addEventListener('mouseup', endDrag)
    },
    [onDrag, endDrag],
  )
  // Remove any live drag listeners on unmount (leak-free).
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onDrag)
      window.removeEventListener('mouseup', endDrag)
    }
  }, [onDrag, endDrag])

  const ledgerBacked = tab === 'overview' || tab === 'logs' || tab === 'events'

  const ledgerBody =
    loading || (records === null && !loadError) ? (
      <YStack flex={1} items="center" justify="center">
        <Text fontSize="$2" color="$color10">
          Loading usage…
        </Text>
      </YStack>
    ) : loadError ? (
      <YStack flex={1} items="center" justify="center" gap="$2">
        <Text fontSize="$2" color="$color10">
          Could not load the usage ledger — {loadError}
        </Text>
        <Button size="$2" onPress={() => void load()}>
          Retry
        </Button>
      </YStack>
    ) : tab === 'overview' ? (
      <OverviewTab records={records ?? []} onGo={go} />
    ) : tab === 'logs' ? (
      <LogsTab records={records ?? []} />
    ) : (
      <EventsTab records={records ?? []} />
    )

  const body =
    tab === 'shell' ? (
      <ShellTab />
    ) : tab === 'traces' ? (
      <TracesTab />
    ) : tab === 'webhooks' ? (
      <WebhooksTab onGo={go} />
    ) : tab === 'health' ? (
      <HealthTab />
    ) : tab === 'inspector' ? (
      <InspectorTab records={records ?? []} />
    ) : (
      ledgerBody
    )

  return (
    <YStack display="none" $lg={{ display: 'flex' }} borderTopWidth={1} borderColor="$borderColor" bg="$color1">
      {open ? (
        <YStack style={{ height }} borderBottomWidth={1} borderColor="$borderColor">
          {/* Drag-to-resize handle — grab the top edge and drag to ANY height. */}
          <div
            onMouseDown={startDrag}
            title="Drag to resize"
            style={{
              height: 8,
              flexShrink: 0,
              cursor: 'ns-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 44, height: 3, borderRadius: 9999, background: 'var(--color7)' }} />
          </div>
          <XStack items="center" gap="$1" px="$2" height={40} borderBottomWidth={1} borderColor="$borderColor">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} flex={1}>
              <XStack items="center" gap="$1">
                {TABS.map((t) => (
                  <Button
                    key={t.id}
                    size="$2"
                    chromeless
                    bg={tab === t.id ? '$color4' : 'transparent'}
                    onPress={() => setTab(t.id)}
                    aria-label={t.label}
                  >
                    {t.label}
                  </Button>
                ))}
              </XStack>
            </ScrollView>
            {ledgerBacked ? (
              <Button
                size="$2"
                chromeless
                icon={<RefreshCw size={14} />}
                onPress={() => void load()}
                aria-label="Refresh usage"
              />
            ) : null}
            <Button
              size="$2"
              chromeless
              icon={height > 500 ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              onPress={() => {
                const max = typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.85) : 720
                const next = height > 500 ? 380 : max
                setHeight(next)
                set('workbenchHeight', next)
              }}
              aria-label={height > 500 ? 'Shrink workbench' : 'Expand workbench'}
            />
            <Button size="$2" chromeless icon={<X size={14} />} onPress={() => set('workbenchOpen', false)} aria-label="Close workbench" />
          </XStack>
          {body}
        </YStack>
      ) : null}

      {/* The always-there Developers bar — the dock's collapsed face. A DISTINCT
          footer strip (tinted bg, taller, clear label) so it reads as a real dock,
          not a hairline. */}
      <XStack items="center" gap="$2" px="$3" height={44} bg="$color2">
        <Button
          size="$2"
          bg="$color4"
          borderWidth={1}
          borderColor="$borderColor"
          icon={<SquareTerminal size={16} />}
          onPress={() => set('workbenchOpen', !open)}
          aria-label={open ? 'Collapse the workbench' : 'Open the workbench'}
        >
          <Text fontSize="$2" fontWeight="700" color="$color12">
            Developers
          </Text>
        </Button>
        {!open ? (
          <XStack
            flex={1}
            items="center"
            gap="$2"
            px="$3"
            height={30}
            rounded="$3"
            borderWidth={1}
            borderColor="$borderColor"
            bg="$color1"
            cursor="pointer"
            hoverStyle={{ borderColor: '$color8' }}
            onPress={() => openTo('shell')}
          >
            <Text fontSize="$2" color="$color11" className="hz-mono">
              $
            </Text>
            <Text flex={1} fontSize="$2" color="$color10" className="hz-mono" numberOfLines={1}>
              Open a cloud shell — a real terminal in your sandbox
            </Text>
          </XStack>
        ) : (
          <XStack flex={1} />
        )}
        <Button size="$2" chromeless icon={<Activity size={16} />} onPress={() => openTo('overview')} aria-label="API activity" />
        <Button size="$2" chromeless icon={<ScrollText size={16} />} onPress={() => openTo('logs')} aria-label="Recent API logs" />
        {/* The assistant's home on desktop — mic starts it listening, the brand mark
            opens it. The floating bubble is hidden at lg+ (this is where it lives);
            it stays on phones, where this dock is not shown. */}
        {voiceOk ? (
          <Button size="$2" chromeless icon={<Mic size={16} />} onPress={startVoice} aria-label="Talk to Hanzo" />
        ) : null}
        <Button
          size="$2"
          bg="$color4"
          borderWidth={1}
          borderColor="$borderColor"
          icon={<BrandMark size={16} />}
          onPress={openChat}
          aria-label="Ask Hanzo"
        >
          <Text fontSize="$2" fontWeight="700" color="$color12">
            AI
          </Text>
        </Button>
      </XStack>
    </YStack>
  )
}
