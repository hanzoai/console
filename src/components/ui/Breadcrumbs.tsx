'use client'

/**
 * Breadcrumbs — where you are, derived from the route + the catalog. The path
 * `/vector/my-db` reads Home / Data / Vector / my-db: the product's category and
 * label come from its catalog entry (so a new product gets correct crumbs for
 * free), and trailing segments are the detail params. Links jump; the category
 * and the current leaf are plain text. Nothing renders on the home route.
 */
import { usePathname, useRouter } from 'next/navigation'
import { Text, XStack } from '@hanzo/gui'
import { ChevronRight } from '@hanzogui/lucide-icons-2'

import { findEntry, categoryFromSlug } from '~/lib/products/registry'
import { productSubpages } from '~/lib/products/match'

type Crumb = { label: string; href?: string }

function crumbsFor(pathname: string): Crumb[] {
  const segs = pathname.split('/').filter(Boolean)
  const crumbs: Crumb[] = [{ label: 'Home', href: '/' }]
  if (segs.length === 0) return crumbs

  if (segs[0] === 'discover') {
    crumbs.push({ label: 'Discover' })
    const e = segs[1] ? findEntry(segs[1]) : undefined
    if (e) crumbs.push({ label: e.label })
    else if (segs[1]) crumbs.push({ label: decodeURIComponent(segs[1]) })
    return crumbs
  }

  if (segs[0] === 'category') {
    crumbs.push({ label: 'Category' })
    const cat = segs[1] ? categoryFromSlug(segs[1]) : null
    if (cat) crumbs.push({ label: cat })
    else if (segs[1]) crumbs.push({ label: decodeURIComponent(segs[1]) })
    return crumbs
  }

  const entry = findEntry(segs[0])
  if (entry) {
    // Skip the category crumb when it just repeats the product's own name — the
    // `Settings` product lives in the `Settings` category, and `Home / Settings /
    // Settings / …` says the same word twice.
    if (entry.category !== entry.label) crumbs.push({ label: entry.category })
    crumbs.push({ label: entry.label, href: segs.length > 1 ? `/${entry.id}` : undefined })
    // Label trailing segments from the product's own sub-page list (so `/settings/logs`
    // reads `… / Logs`, not the raw slug); detail params that aren't sub-pages pass through.
    const subs = productSubpages(entry)
    for (let i = 1; i < segs.length; i++) {
      const sp = subs.find((s) => s.slug === segs[i])
      crumbs.push({ label: sp ? sp.label : decodeURIComponent(segs[i]) })
    }
  } else {
    for (const s of segs) crumbs.push({ label: decodeURIComponent(s) })
  }
  return crumbs
}

export function Breadcrumbs() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const crumbs = crumbsFor(pathname)
  if (crumbs.length <= 1) return null

  return (
    <XStack items="center" gap="$1.5" flexWrap="wrap">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <XStack key={`${c.label}-${i}`} items="center" gap="$1.5">
            {i > 0 ? <ChevronRight size={13} opacity={0.4} /> : null}
            {c.href && !last ? (
              <Text
                fontSize="$2"
                color="$color11"
                hoverStyle={{ color: '$color12' }}
                cursor="pointer"
                onPress={() => router.push(c.href!)}
              >
                {c.label}
              </Text>
            ) : (
              <Text fontSize="$2" color={last ? '$color12' : '$color10'} fontWeight={last ? '600' : '400'}>
                {c.label}
              </Text>
            )}
          </XStack>
        )
      })}
    </XStack>
  )
}
