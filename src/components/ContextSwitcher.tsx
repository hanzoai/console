'use client'

/**
 * Context switcher — WHERE you are: the organization and the project, in ONE
 * control, at the TOP-LEFT where the tenant's mark already sits.
 *
 * The console used to answer "who and where am I" from three different corners:
 * the org at the top of the rail, the account (which also switched org) at its
 * foot, and the project chip in the top-right beside the network. Org and
 * project are one question — which tenant, and which slice of it — so they are
 * one control, and it sits with the org mark that already anchors the top-left.
 *
 * The ACCOUNT keeps the other question ("who am I": identity, team, personal
 * settings, the way out) at the foot of the rail. The NETWORK stays its own
 * control in the top-right, because it is a global MODE rather than a place —
 * and its tier dot is a destructive-environment guard, not decoration.
 *
 * There is still exactly ONE org switch. `switchOrg` is passed by reference from
 * `~/lib/org-scope` (the seam that persists the scope and reloads so every
 * module refetches under the new `X-Org-Id`, which is where tenant scoping and
 * its billing attribution already live). This control does not mint a second
 * one, add a header of its own, or make a billing call — `org-state.test.ts`
 * pins that identity. Cross-tenant reach is the SAME admin-gated, server-paged
 * list the full-page picker uses; a regular user never fires it and sees only
 * their own org.
 */
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Popover, Text, XStack, YStack } from '@hanzo/gui'
import { ChevronsUpDown, FolderGit2, Plus, SlidersHorizontal } from '@hanzogui/lucide-icons-2'

import { useScope } from '~/lib/scope-context'
import { useOrgIdentity } from '~/components/ui/BrandLogo'
import { useIsSuperAdmin } from '~/lib/auth/admin'
import { IamAdminApi, type Organization } from '~/lib/api'
import { ORG_PAGE_SIZE, orgQuery } from '~/lib/org-list'
import { currentOrg, leaveOrg, switchOrg } from '~/lib/org-scope'
import { contextLabel, scopedOrgRow, titleCase } from '~/lib/account/org-state'
import { MenuRow } from '~/components/ui/MenuRow'
import { paper } from '~/components/ui/paper'
import { OrgMark, SearchInput } from '@hanzo/ui/product'

export function ContextSwitcher() {
  const router = useRouter()
  const org = useOrgIdentity()
  const scoped = currentOrg()
  const isSuperAdmin = useIsSuperAdmin()
  const { scope, projects, loadingProjects, selectProject } = useScope()
  const [open, setOpen] = useState(false)
  const [orgs, setOrgs] = useState<Organization[] | null>(null)
  const [query, setQuery] = useState('')

  // IAM's display name when it has one; otherwise the slug, titled the same way
  // `scopedOrgRow` titles it — one rule, so the trigger and the list agree.
  const orgLabel = org.displayName || titleCase(org.name || scoped)

  // The cross-tenant list is admin-gated at the proxy; a regular user would 403
  // it, so they are never asked to — their own org is the honest answer. An admin
  // searches the SERVER (the list is paged and far longer than one page), which is
  // the only way to reach a tenant nobody is a member of.
  const loadOrgs = useCallback(
    async (q: string) => {
      if (!isSuperAdmin) return setOrgs(scopedOrgRow(scoped) as Organization[])
      const res = await IamAdminApi.organizations(orgQuery(0, q, ORG_PAGE_SIZE))
      setOrgs(res.rows ?? [])
    },
    [isSuperAdmin, scoped],
  )

  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next && orgs === null) void loadOrgs('')
    },
    [orgs, loadOrgs],
  )

  const search = useCallback(
    (q: string) => {
      setQuery(q)
      void loadOrgs(q)
    },
    [loadOrgs],
  )

  const pick = useCallback(
    (fn: () => void) => () => {
      setOpen(false)
      fn()
    },
    [],
  )

  const orgRows = useMemo(() => orgs ?? [], [orgs])

  return (
    <Popover open={open} onOpenChange={onOpenChange} placement="bottom-start">
      <Popover.Trigger asChild>
        <Button
          size="$3"
          chromeless
          justify="flex-start"
          px="$2"
          data-testid="switcher-context"
          iconAfter={<ChevronsUpDown size={13} opacity={0.6} />}
          aria-label={`Organization and project — ${contextLabel(orgLabel, scope.project)}`}
        >
          {org.logo ? (
            // The org's own logo IS the label — the uploaded mark takes the
            // slot the name held, height-capped to the row so any aspect fits.
            // A scoped project keeps its text beside it; the full text stays
            // in the aria-label either way. Arbitrary tenant URL/data URL, so
            // a raw <img> (next/image would need a per-tenant remote
            // allow-list) — same call BrandLogo makes.
            <XStack items="center" gap="$2" flex={1} minW={0}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={org.logo}
                alt={orgLabel}
                style={{ height: 22, width: 'auto', maxWidth: 140, objectFit: 'contain', display: 'block' }}
              />
              {scope.project ? (
                <Text fontSize="$3" fontWeight="600" color="$color12" numberOfLines={1} flex={1}>
                  / {scope.project}
                </Text>
              ) : null}
            </XStack>
          ) : (
            // No uploaded logo: lead with the org's shared OrgMark (its monogram —
            // the SAME mark SidebarBrand and the account widget wear), so the switcher
            // is never a bare name. White-label safe: OrgMark is the tenant's OWN mark
            // (the org's IAM logo when set, else its monogram), never the house glyph.
            <XStack items="center" gap="$2" flex={1} minW={0}>
              <OrgMark org={org} size={20} />
              <Text fontSize="$3" fontWeight="600" color="$color12" numberOfLines={1} flex={1}>
                {contextLabel(orgLabel, scope.project)}
              </Text>
            </XStack>
          )}
        </Button>
      </Popover.Trigger>

      <Popover.Content {...paper} p="$2" width={280}>
        <YStack gap="$0.5">
          <Text px="$2" py="$1" fontSize="$1" color="$color10" fontWeight="500">
            Organization
          </Text>

          {/* Admins only: the cross-tenant list is server-paged and longer than
              one page, so reaching a tenant nobody is a member of means SEARCHING
              it, not scrolling. A regular user has one org and no field. */}
          {isSuperAdmin ? (
            <YStack px="$1" pb="$1">
              {/* A search landmark names the control for assistive tech — the shared
                  SearchInput has no accessible-name prop of its own. */}
              <div role="search" aria-label="Find an organization">
                <SearchInput value={query} onChange={search} placeholder="Find an organization" name="org" />
              </div>
            </YStack>
          ) : null}

          <YStack role="radiogroup" aria-label="Organizations" gap="$0.5">
            {orgRows.map((o) => (
              <MenuRow
                key={o.name}
                label={o.displayName || o.name}
                icon={<OrgMark org={o} size={18} />}
                active={scoped === o.name}
                onPress={pick(() => {
                  if (o.name !== scoped) switchOrg(o.name)
                })}
              />
            ))}
          </YStack>

          {orgRows.length === 0 ? (
            <Text px="$2" py="$1.5" fontSize="$2" color="$color10">
              {orgs === null ? 'Loading…' : 'No organization matches that.'}
            </Text>
          ) : null}

          <MenuRow
            label="Organization settings"
            icon={<SlidersHorizontal size={14} />}
            onPress={pick(() => router.push('/settings/branding'))}
          />

          <MenuRow label="All organizations" icon={<Plus size={14} />} onPress={pick(leaveOrg)} />

          <XStack height={1} bg="$borderColor" my="$1" />

          <Text px="$2" py="$1" fontSize="$1" color="$color10" fontWeight="500">
            Project
          </Text>

          <YStack role="radiogroup" aria-label="Projects" gap="$0.5">
            {/* Org-level scope — no X-Project-Id sent. */}
            <MenuRow
              label="All projects"
              sub="Org-level"
              active={!scope.project}
              onPress={pick(() => selectProject(undefined))}
            />

            {projects.map((p) => (
              <MenuRow
                key={p.name}
                label={p.displayName || p.name}
                active={scope.project === p.name}
                onPress={pick(() => selectProject(p.name))}
              />
            ))}
          </YStack>

          {projects.length === 0 && !loadingProjects ? (
            <Text px="$2" py="$1.5" fontSize="$2" color="$color10">
              No projects yet.
            </Text>
          ) : null}

          <MenuRow
            label="New project"
            icon={<FolderGit2 size={14} />}
            onPress={pick(() => router.push('/projects'))}
          />
        </YStack>
      </Popover.Content>
    </Popover>
  )
}
