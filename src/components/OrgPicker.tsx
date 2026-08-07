'use client'

/**
 * Org picker — the org-LESS landing every login sees first.
 *
 * The two-level model's top level: a full-page list of the organizations the
 * caller can act in. A one-org user sees a single card and clicks in (we never
 * auto-enter); a global admin (z@hanzo.ai) sees EVERY live org and can enter any
 * of them (masquerade). Clicking a card {@link enterOrg} scopes the whole console
 * to that org (X-Org-Id) and drops into it; the sidebar "Home" affordance
 * ({@link leaveOrg}) returns here and de-scopes.
 *
 * Data source: a global admin lists every org via the gated `/admin/iam` proxy;
 * everyone else lists the orgs they are a MEMBER of — their membership rows
 * unioned with their home org, each read as its own record so a card carries the
 * ORG's name and logo. It never fabricates an org, and it never labels one with
 * the signed-in person. All decisions (sort, filter, paginate, card view-model) live in the pure
 * `org-picker/logic.ts`; this file is a thin render of it with honest loading /
 * empty / error states.
 */
import { useEffect, useMemo, useState } from 'react'
import { Building2, LayoutGrid, Plus, Search } from '@hanzogui/lucide-icons-2'
import { Button, Card, Input, Spinner, Text, XStack, YStack } from '@hanzo/gui'

import { getBrand } from '~/lib/branding/brands'
import { useSession } from '~/lib/auth/session'
import { useIsSuperAdmin } from '~/lib/auth/admin'
import { enterOrg } from '~/lib/org-scope'
import { IamAdminApi, MembershipApi, TeamApi, orgNamesFor, type Organization } from '~/lib/api'
import { BrandMark } from '~/components/ui/BrandLogo'
import { OrgOnboarding } from '~/components/OrgOnboarding'
import { PAGE_SIZE, pickerView, type OrgCard, type PickerContext } from '~/components/org-picker/logic'
import { EmptyState, FadeIn } from '@hanzo/ui/product'

const titleCase = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** One org card — logo or monogram, label, honest role + quick facts. */
function OrgCardView({ card, onEnter }: { card: OrgCard; onEnter: () => void }) {
  return (
    <Card
      onPress={onEnter}
      cursor="pointer"
      role="button"
      aria-label={`Open ${card.title}`}
      borderWidth={1}
      borderColor="$borderColor"
      bg="$color1"
      p="$4"
      gap="$3"
      width={280}
      minW={240}
      hoverStyle={{ bg: '$color2', borderColor: '$color8' }}
      pressStyle={{ opacity: 0.85 }}
    >
      <XStack items="center" gap="$3">
        {card.logo ? (
          // Arbitrary external org logo — raw <img> (next/image would need a
          // per-tenant remote allowlist).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.logo}
            alt=""
            style={{ height: 40, width: 40, objectFit: 'contain', display: 'block', borderRadius: 8 }}
          />
        ) : (
          <YStack width={40} height={40} rounded="$4" bg="$color4" items="center" justify="center">
            <Text fontSize="$4" fontWeight="800" color="$color12">
              {card.initials}
            </Text>
          </YStack>
        )}
        <YStack flex={1} minW={0}>
          <Text fontSize="$5" fontWeight="700" color="$color12" numberOfLines={1}>
            {card.title}
          </Text>
          <Text fontSize="$1" color="$color10" numberOfLines={1}>
            {card.name}
          </Text>
        </YStack>
      </XStack>

      <XStack items="center" gap="$2" flexWrap="wrap">
        <XStack items="center" gap="$1.5" bg="$color3" rounded="$10" px="$2.5" py="$1">
          <Building2 size={12} opacity={0.7} />
          <Text fontSize="$1" color="$color11" fontWeight="600">
            {card.role}
          </Text>
        </XStack>
        {card.facts.map((f) => (
          <Text key={f.label} fontSize="$1" color="$color10" numberOfLines={1}>
            {f.label}: <Text color="$color11">{f.value}</Text>
          </Text>
        ))}
      </XStack>
    </Card>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <YStack flex={1} minH="100vh" items="center" justify="center" p="$4" gap="$4">
      {children}
    </YStack>
  )
}

export function OrgPicker() {
  const { account } = useSession()
  const isSuperAdmin = useIsSuperAdmin()
  const owner = account?.owner ?? ''

  const [orgs, setOrgs] = useState<Organization[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  // The caller's HOME org, named by its own slug — the last-resort fallback when
  // even the membership read fails.
  //
  // Its displayName used to be `account.displayName`, which is the signed-in
  // PERSON. An org card then announced a human ("Dave Lorenzini") where the
  // organization belongs, and the monogram it derived was the person's initials
  // rather than the org's mark. A person is not an org; when the org's own row
  // cannot be read, its slug is the honest label.
  const ownOrgOnly = useMemo<Organization[]>(
    () => (owner ? [{ owner: 'admin', name: owner, displayName: titleCase(owner) } as Organization] : []),
    [owner],
  )

  // Load the caller's visible orgs. A global admin gets the full cross-tenant list
  // (paged large, then this component client-paginates). Everyone else gets the
  // orgs they are a MEMBER of — their memberships unioned with their home org,
  // each read as its own row so the card shows the ORG's name and logo.
  //
  // This used to be one card synthesized from the session, which could never show
  // a second org: a customer with a workspace besides their home tenant simply did
  // not see it. Reading each row is also what puts a real logo on the card; IAM
  // authorizes a member to read the orgs they belong to (v1.34.26), so the fetch
  // that used to 403 for a tenant now answers.
  useEffect(() => {
    if (!owner) return
    let live = true
    if (!isSuperAdmin) {
      const me = account?.name ? `${owner}/${account.name}` : ''
      if (!me) {
        setOrgs(ownOrgOnly)
        return
      }
      MembershipApi.mine(me)
        .then((rows) => orgNamesFor(owner, rows))
        .then((names) =>
          // One read per org, and a row that cannot be read degrades to its slug
          // rather than dropping the org off a list the person is entitled to see.
          Promise.all(
            names.map((name) =>
              TeamApi.organization(name).catch(
                () => ({ owner: 'admin', name, displayName: titleCase(name) }) as Organization,
              ),
            ),
          ),
        )
        .then((rows) => {
          if (live) setOrgs(rows)
        })
        .catch(() => {
          if (live) setOrgs(ownOrgOnly)
        })
      return () => {
        live = false
      }
    }
    setOrgs(null)
    setError(null)
    IamAdminApi.organizations({ pageSize: 1000 })
      .then((p) => {
        if (live) setOrgs(p.rows ?? [])
      })
      .catch(() => {
        // The cross-tenant list is unavailable — surface it honestly, but still fall
        // back to the caller's own org so the picker is never a dead screen.
        if (live) {
          setError('Could not load all organizations — showing your own.')
          setOrgs(ownOrgOnly)
        }
      })
    return () => {
      live = false
    }
  }, [owner, isSuperAdmin, ownOrgOnly, account?.name])

  const ctx: PickerContext = useMemo(
    () => ({ ownOrg: owner, isSuperAdmin, callerIsAdmin: Boolean(account?.isAdmin) }),
    [owner, isSuperAdmin, account?.isAdmin],
  )

  const view = useMemo(
    () => (orgs ? pickerView(orgs, query, page, ctx) : null),
    [orgs, query, page, ctx],
  )

  const brandName = getBrand().brandName.replace(' Cloud', '')

  // "Create organization" → the sanctioned onboarding flow (its own success re-auth),
  // with a way back to the list.
  if (creating) {
    return (
      <YStack flex={1} minH="100vh">
        <XStack p="$3">
          <Button size="$2" chromeless icon={<LayoutGrid size={14} />} onPress={() => setCreating(false)}>
            All organizations
          </Button>
        </XStack>
        <OrgOnboarding />
      </YStack>
    )
  }

  // Loading — the first org fetch hasn't settled.
  if (!view) {
    return (
      <Center>
        <Spinner size="large" color="$color11" />
        <Text fontSize="$3" color="$color10">
          Loading your organizations…
        </Text>
      </Center>
    )
  }

  return (
    <YStack flex={1} minH="100vh" items="center" px="$4" py="$8" $md={{ py: '$10' }}>
      <YStack width="100%" maxW={1040} gap="$6">
        {/* Hero — brand mark + what this is. */}
        <FadeIn style={{ width: '100%' }}>
          <YStack gap="$3" items="center">
            <XStack items="center" gap="$2.5">
              <BrandMark size={30} />
              <Text fontSize="$8" fontWeight="800" color="$color12" letterSpacing={-0.6}>
                {brandName} Console
              </Text>
            </XStack>
            <Text fontSize="$5" fontWeight="700" color="$color12" text="center">
              Choose an organization
            </Text>
            <Text fontSize="$3" color="$color11" maxW={520} text="center">
              {isSuperAdmin
                ? 'Pick an organization to manage. As a platform admin you can enter any of them.'
                : 'Select your organization to open its console.'}
            </Text>
          </YStack>
        </FadeIn>

        {/* Search + create — only show search once there's enough to filter. */}
        <XStack items="center" gap="$2" flexWrap="wrap" justify="center">
          {orgs && orgs.length > 6 ? (
            <XStack
              items="center"
              gap="$2"
              px="$3"
              height={40}
              rounded="$4"
              borderWidth={1}
              borderColor="$borderColor"
              bg="$color2"
              flex={1}
              minW={240}
              maxW={420}
            >
              <Search size={15} opacity={0.6} />
              <Input
                flex={1}
                unstyled
                value={query}
                onChangeText={(v) => {
                  setQuery(v)
                  setPage(1)
                }}
                placeholder="Filter organizations…"
                fontSize="$3"
                color="$color12"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </XStack>
          ) : null}
          <Button
            size="$3"
            icon={<Plus size={16} />}
            onPress={() => setCreating(true)}
            aria-label="Create organization"
          >
            Create organization
          </Button>
        </XStack>

        {/* Error — the fetch itself failed (we still degrade to own-org above, so this
            is rare; kept honest rather than silent). */}
        {error ? (
          <Text fontSize="$2" color="$red10" text="center">
            {error}
          </Text>
        ) : null}

        {/* Grid, empty, or no-match — all honest. */}
        {view.total === 0 && query.trim() ? (
          <Text fontSize="$3" color="$color10" text="center">
            No organizations match “{query.trim()}”.
          </Text>
        ) : view.total === 0 ? (
          <EmptyState
            icon={Building2}
            title="No organizations yet"
            description="Create your first organization to start using the console."
            primary={{ label: 'Create organization', icon: <Plus size={15} />, onPress: () => setCreating(true) }}
          />
        ) : (
          <>
            <XStack flexWrap="wrap" gap="$3" justify="center">
              {view.cards.map((card) => (
                <OrgCardView key={card.key} card={card} onEnter={() => enterOrg(card.name)} />
              ))}
            </XStack>

            {view.hasMore ? (
              <XStack justify="center">
                <Button size="$3" chromeless onPress={() => setPage((p) => p + 1)}>
                  Show {Math.min(view.remaining, PAGE_SIZE)} more
                  {view.remaining > PAGE_SIZE ? ` of ${view.remaining}` : ''}
                </Button>
              </XStack>
            ) : null}

            <Text fontSize="$1" color="$color9" text="center">
              {view.shown} of {view.total} {view.total === 1 ? 'organization' : 'organizations'}
            </Text>
          </>
        )}
      </YStack>
    </YStack>
  )
}
