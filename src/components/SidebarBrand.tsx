'use client'

/**
 * Top-left mark — the identity of the ORGANIZATION the console is scoped to.
 *
 * White-label is the point: a customer's console must show the customer's mark,
 * never ours. So this renders the ONE shared `OrgMark` (@hanzo/ui) — the org's
 * own logo when IAM carries one, else the org's MONOGRAM, the same treatment the
 * account widget gives a person. It is never the house glyph and never the org
 * name set as running text.
 *
 * The house `BrandMark` still exists, but for the PRODUCT's own moments (the
 * assistant trigger, the org picker, onboarding) — not for the tenant's slot.
 *
 * Left-click → product home (`/`); RIGHT-CLICK → a small brand context menu
 * (Settings · Brand · Docs · About), the same affordance the shared shell's
 * HanzoMark exposes.
 *
 * The interactive surface is a plain `<div>` (the console's own escape hatch, as
 * used for `<div onScroll>` in OrgSwitcher) so the native `contextmenu` event is
 * guaranteed to fire. The menu reuses the console's one menu surface (a `$color2`
 * paper sheet with the shared `hz-paper hz-menu-in` styling) — no new menu
 * system; it is a cursor-anchored overlay (a right-click has no trigger rect to
 * anchor a Popover to).
 */
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Text, XStack, YStack } from '@hanzo/gui'
import { BookOpen, Globe, Info, SlidersHorizontal } from '@hanzogui/lucide-icons-2'

import { config } from '~/config'
import { getBrand } from '~/lib/branding/brands'
import { BrandMark, useOrgIdentity } from '~/components/ui/BrandLogo'
import { Z } from '~/lib/z'
import { OrgMark } from '@hanzo/ui/product'

type MenuItem = {
  icon: typeof SlidersHorizontal
  label: string
  onSelect: () => void
}

/** The cursor-anchored brand menu — clamped inside the viewport, closes on
 *  outside-click / Escape. One paper sheet, shared chrome styling. */
function BrandMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Clamp so the sheet never spills past the viewport edge.
  const left = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - 200) : x
  const top = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - 200) : y

  return (
    <div ref={ref} role="menu" style={{ position: 'fixed', left, top, zIndex: Z.dropdown }}>
      <YStack
        className="hz-paper hz-menu-in"
        minW={184}
        p="$1.5"
        gap="$0.5"
        rounded="$4"
        bg="$color2"
        borderWidth={1}
        borderColor="$borderColor"
      >
        {items.map((item) => (
          <XStack
            key={item.label}
            role="menuitem"
            onPress={() => {
              onClose()
              item.onSelect()
            }}
            cursor="pointer"
            items="center"
            gap="$2.5"
            px="$2"
            py="$2"
            rounded="$3"
            hoverStyle={{ bg: '$color4' }}
          >
            <item.icon size={15} />
            <Text fontSize="$2" color="$color12">
              {item.label}
            </Text>
          </XStack>
        ))}
      </YStack>
    </div>
  )
}

/**
 * The top-left org mark. `collapsed` centers it in the icon rail. Left-click →
 * home; right-click → the brand context menu.
 */
export function SidebarBrand({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const router = useRouter()
  const brand = getBrand()
  // The tenant leads the chrome: its own logo when set, else its monogram — never
  // the house mark. `useOrgIdentity` is the ONE cached org-identity source.
  const org = useOrgIdentity()
  const orgLabel = org.displayName || org.name
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const go = useCallback(
    (path: string) => {
      router.push(path)
      onNavigate?.()
    },
    [router, onNavigate],
  )

  const openExternal = useCallback((url: string) => {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener')
  }, [])

  const onContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // Settings + Docs are REAL, always-resolving targets (the `/settings` product +
  // the brand's docs site); Brand + About open the brand's own marketing site
  // (white-labeled — a lux/zoo host opens ITS site, never hanzo.ai). No dead links.
  const items: MenuItem[] = [
    { icon: SlidersHorizontal, label: 'Settings', onSelect: () => go('/settings') },
    { icon: Globe, label: 'Brand', onSelect: () => openExternal(`${brand.websiteUrl}/brand`) },
    { icon: BookOpen, label: 'Docs', onSelect: () => openExternal(config.docsUrl) },
    { icon: Info, label: 'About', onSelect: () => openExternal(brand.websiteUrl) },
  ]

  return (
    <>
      <div
        onClick={() => go('/')}
        onContextMenu={onContextMenu}
        role="link"
        aria-label={`${orgLabel} — home (right-click for brand menu)`}
        title={orgLabel}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          height: 40,
          paddingLeft: collapsed ? 0 : 4,
          cursor: 'pointer',
          color: 'var(--color12)',
        }}
      >
        {/* A logo may be a wordmark, so it is allowed to run wide; the monogram
            stays the square tile the account avatar wears.

            `data-monogram`: OrgMark is a DISTRIBUTED component that sizes its
            monogram glyph proportionally to its tile, so it paints text off the
            app type scale by design — correct for a mark, wrong to police. The
            marker declares that here, at our call site, rather than teaching the
            design gate a library's class names. */}
        <span data-monogram style={{ display: 'contents' }}>
          {org.logo ? (
            <OrgMark org={org} size={24} maxW={140} />
          ) : (
            // An org that has not uploaded a mark yet wears the HOST's brand, not
            // its own initial: on console.hanzo.ai that is the Hanzo mark, on a
            // white-labelled host the brand that host resolves to. The surface
            // reads as the tenant's own from the first sign-in, and uploading a
            // logo in Settings → Branding replaces it.
            <BrandMark size={24} />
          )}
        </span>
      </div>
      {menu ? <BrandMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)} /> : null}
    </>
  )
}
