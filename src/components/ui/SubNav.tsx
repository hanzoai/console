'use client'

/**
 * SubNav — the ONE level-2 nav for a product.
 *
 * Clicking into a product reveals ITS options rather than replacing the screen.
 * That second level lives in the SIDEBAR (`SubRows`), expanded beneath the product's
 * own row — the house pattern. This strip is the SAME nav, rendered from
 * the SAME source (`productSubpages` over the registry), for the viewports where
 * the sidebar is not on screen: below `lg` the sidebar is a drawer, so the strip
 * carries level 2 in the content column and hides itself at `lg+` where the rail
 * already shows it. One declaration, two mounts — never two navs at once, and never
 * two lists that can disagree.
 *
 * It replaces the private `const TABS` every tabbed module used to carry. Those
 * arrays were a second, parallel level-2 nav: `/models` showed eight items in the
 * rail and four in the content, disagreeing even on the index's own name. The
 * registry is the one source now — a product's tabs, their order, their icons, and
 * what its index is called (`indexLabel`) are declared once and read everywhere.
 *
 * Level is carried by the URL and nothing else, so a reload, a deep link, and Back
 * all resolve to the same tab (`activeSubpage`).
 */
import { usePathname, useRouter } from 'next/navigation'
import { Button, XStack } from '@hanzo/gui'
import {
  Activity,
  BarChart3,
  Circle,
  Coins,
  CreditCard,
  FileText,
  House,
  Receipt,
  Repeat,
  ScrollText,
  SlidersHorizontal,
  Target,
  Users,
} from '@hanzogui/lucide-icons-2'
import type { ComponentType } from 'react'

import { findEntry } from '~/lib/products/registry'
import { productSubpages, subpageHref, activeSubpage, subpageWired } from '~/lib/products/match'
import { useIsSuperAdmin } from '~/lib/auth/admin'

/** Default icon for a level-2 sub-page — the uniform base slugs get a real one,
 *  a product's own specific falls back to a quiet dot unless it declares one. */
const SUBPAGE_ICON: Record<string, ComponentType<{ size?: number }>> = {
  '': House,
  settings: SlidersHorizontal,
  status: Activity,
  logs: ScrollText,
  metrics: BarChart3,
  // Common billing/finance slugs get a real icon here (the ONE shared map) rather
  // than the quiet dot, so every product that names one is iconed — not just billing.
  reports: FileText,
  accounts: Users,
  budgets: Target,
  invoices: Receipt,
  subscriptions: Repeat,
  'payment-methods': CreditCard,
  credits: Coins,
}

/** A View is flex-shrink:0 by default; a wrapping row needs this to wrap at all. */
const SHRINK = { flexShrink: 1 } as const

export const subpageIcon = (slug: string): ComponentType<{ size?: number }> => SUBPAGE_ICON[slug] ?? Circle

export function SubNav({
  id,
  href,
}: {
  /** The product whose level-2 nav this is (a catalog id). */
  id: string
  /** Optional href override, for a product whose tabs carry extra URL state
   *  (Containers keeps its `?cluster=` selection across tabs). */
  href?: (slug: string) => string
}) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const showAdmin = useIsSuperAdmin()

  const entry = findEntry(id)
  if (!entry || entry.kind !== 'module') return null
  const subs = productSubpages(entry, showAdmin)
  if (subs.length <= 1) return null

  const active = activeSubpage(pathname, id)
  const to = href ?? ((slug: string) => subpageHref(id, slug))

  return (
    // Hidden at lg+ — the sidebar's SubRows is the level-2 nav there. Purely a
    // CSS media style prop (not a JS media branch), so SSR and first paint match.
    <XStack
      gap="$1.5"
      flexWrap="wrap"
      // A View is `flex-shrink: 0` and min-width:auto by default, so placed in a
      // row this nav would hold its max-content width, never engage its own
      // flex-wrap, and paint past the right edge of a phone — the exact bug the
      // footer had. Measured at 390px.
      style={SHRINK}
      minW={0}
      $lg={{ display: 'none' }}
      role="navigation"
      aria-label={`${entry.label} sections`}
      // A `display: none` element leaves the accessibility tree, so the role/label
      // above cannot be queried while the rail owns level 2 — the hook a test needs
      // precisely then, to prove there is no second nav painting.
      data-testid={`subnav-${id}`}
    >
      {subs.map((sp) => {
        const isActive = sp.slug === active
        const wired = subpageWired(id, sp.slug)
        const Icon = sp.icon ?? subpageIcon(sp.slug)
        return (
          <Button
            key={sp.slug || 'index'}
            size="$2"
            icon={<Icon size={15} />}
            bg={isActive ? '$color5' : 'transparent'}
            borderWidth={1}
            borderColor="$borderColor"
            opacity={wired ? 1 : 0.6}
            onPress={() => router.push(to(sp.slug))}
            aria-current={isActive ? 'page' : undefined}
            aria-label={wired ? sp.label : `${sp.label} (not available yet)`}
          >
            {sp.label}
          </Button>
        )
      })}
    </XStack>
  )
}
