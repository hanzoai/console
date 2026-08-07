'use client'

/**
 * Model Catalog — the unified, family-grouped model browser, identical in grouping
 * to hanzo.chat's picker: the house-brand **Zen** first, then the third-party
 * families the same api.hanzo.ai gateway serves (Qwen · Meta Llama · DeepSeek ·
 * Mistral · Google Gemma · OpenAI GPT-OSS). ONE console home for choosing a model,
 * the same set of families a user sees in chat.
 *
 * Source: the live catalog via `aicatalog.fetchCatalog` (the rich
 * `/v1/pricing/models` joined with `/v1/models` for availability, through the
 * authenticated `/ai` proxy). `groupByFamily` (pure, unit-tested) buckets it into
 * the curated families — current-gen chat models only (no sunset zen4/qwen2, no
 * embeddings/tts/asr/image/guard), empty families dropped. Every value shown is a
 * REAL catalog field: context, per-Mtok pricing, live availability. Click a model
 * for full specs/pricing/features. Honest loading/error/empty; nothing fabricated.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Text, XStack, YStack } from '@hanzo/gui'
import { RefreshCw, ArrowLeft, Play, Settings2, Copy, Boxes, ChevronDown, ChevronRight } from '@hanzogui/lucide-icons-2'

import {
  fetchCatalog,
  fetchPlans,
  plansForTier,
  displayProvider,
  modelType,
  modelContext,
  modelDisplayName,
  modelId,
  supportsVision,
  fmtPrice,
  fmtContext,
  type CatalogEntry,
  type Plan,
} from '~/lib/api/aicatalog'
import { priorFor } from '~/lib/api/benchmarks'
import {
  groupByFamily,
  filterFamilies,
  familyOf,
  suggestedModels,
  totalModels,
  displayLabel,
  DEFAULT_MODEL,
  type FamilyGroup,
} from '~/lib/api/families'
import { useRecentModels } from '~/lib/models/recent'
import { ProviderLogo } from '~/components/ui/ProviderLogo'
import { Filters } from '~/components/ui/Filters'
import { useList } from '~/lib/list'
import { ErrorState, asApiError } from '~/components/ui/States'
import { playgroundPathForModel } from './playground/share'
import type { ApiError } from '~/lib/api'
import { FadeIn, PageHeader } from '@hanzo/ui/product'

/** Tabular-numeral className — fixed-advance digits for the numeric columns. */
const TNUM = 'hz-tnum'

const Pill = ({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'live' | 'brand' }) => (
  <Text
    fontSize="$1"
    px="$2"
    py="$1"
    rounded="$2"
    bg={tone === 'live' ? '$green3' : tone === 'brand' ? '$color12' : '$color3'}
    color={tone === 'live' ? '$green11' : tone === 'brand' ? '$color1' : '$color11'}
  >
    {label}
  </Text>
)

/** A labelled fact cell for the detail grid. */
const Fact = ({ label, value }: { label: string; value: string }) => (
  <YStack gap={2} minW={130}>
    <Text fontSize="$1" color="$color10">
      {label}
    </Text>
    <Text fontSize="$3" color="$color12">
      {value}
    </Text>
  </YStack>
)

/** One subscription-tier badge (resolved from the model's `tier` via /v1/plans). */
function PlanBadge({ plan }: { plan: Plan }) {
  const rpm = plan.limits?.requestsPerMinute
  const tpm = plan.limits?.tokensPerMinute
  const limit =
    rpm && tpm ? `${rpm.toLocaleString()} rpm · ${(tpm / 1000).toLocaleString()}k tpm`
    : rpm ? `${rpm.toLocaleString()} rpm`
    : tpm ? `${(tpm / 1000).toLocaleString()}k tpm`
    : null
  return (
    <YStack px="$2.5" py="$1.5" rounded="$3" bg="$color3" gap={1}>
      <Text fontSize="$2" fontWeight="700" color="$color12">{plan.name}</Text>
      {limit ? <Text fontSize="$1" color="$color10">{limit}</Text> : null}
    </YStack>
  )
}

/** Click-through model detail — full specs, pricing, features, and config actions. */
function ModelDetailPanel({ m, plans, onBack }: { m: CatalogEntry; plans: Plan[]; onBack: () => void }) {
  const router = useRouter()
  const tierPlans = plansForTier(m.tier, plans)
  const mid = modelId(m)
  const copyId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) void navigator.clipboard.writeText(mid)
  }
  return (
    <YStack gap="$4">
      <XStack items="center" gap="$2">
        <Button size="$2" chromeless icon={<ArrowLeft size={16} />} onPress={onBack}>
          Catalog
        </Button>
      </XStack>

      <YStack gap="$2">
        <XStack items="center" gap="$3" flexWrap="wrap">
          {/* Brand resolved from the model identity (id/name) — a gateway-served model
              (tagged provider "hanzo") still shows its true vendor; Zen → the Hanzo mark. */}
          <ProviderLogo provider={familyOf(m)?.logo ?? m.provider ?? 'Other'} model={modelId(m)} size={40} />
          <Text fontSize="$8" fontWeight="800" color="$color12">
            {modelDisplayName(m)}
          </Text>
          {m.specs?.params ? <Pill label={m.specs.params} /> : null}
          {m.available ? <Pill label="● Available" tone="live" /> : <Pill label="Catalog" />}
        </XStack>
        {m.fullName ? (
          <Text fontSize="$4" color="$color11">
            {m.fullName}
          </Text>
        ) : null}
        {m.description ? (
          <Text fontSize="$3" color="$color10">
            {m.description}
          </Text>
        ) : null}
      </YStack>

      <XStack gap="$2" flexWrap="wrap">
        {/* Primary: open the Playground PRESELECTED on this model (deep-links ?p=…). */}
        <Button size="$3" theme="light" icon={<Play size={15} />} onPress={() => router.push(playgroundPathForModel(mid))}>
          Try in Playground
        </Button>
        <Button
          size="$3"
          icon={<Settings2 size={15} />}
          onPress={() => router.push(`/models/routing/${encodeURIComponent(mid)}`)}
        >
          Configure routing
        </Button>
        <Button size="$3" chromeless icon={<Copy size={15} />} onPress={copyId}>
          Copy ID
        </Button>
      </XStack>

      <XStack
        gap="$5"
        flexWrap="wrap"
        rounded="$4"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$color1"
        p="$4"
      >
        <Fact label="Type" value={modelType(m)} />
        <Fact label="Provider" value={familyOf(m).id === 'other' ? displayProvider(m.provider) : familyOf(m).label} />
        <Fact label="Context" value={fmtContext(modelContext(m))} />
        <Fact label="Tier" value={m.tier ? m.tier : '—'} />
        <Fact label="Input / Mtok" value={fmtPrice(m.pricing?.input)} />
        <Fact label="Output / Mtok" value={fmtPrice(m.pricing?.output)} />
        <Fact label="Cache read / Mtok" value={fmtPrice(m.pricing?.cacheRead)} />
        <Fact label="Cache write / Mtok" value={fmtPrice(m.pricing?.cacheWrite)} />
        {m.specs?.arch ? <Fact label="Architecture" value={m.specs.arch} /> : null}
      </XStack>

      {tierPlans.length > 0 ? (
        <YStack gap="$2">
          <Text fontSize="$2" color="$color11" fontWeight="600">
            Included in plans
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {tierPlans.map((p) => (
              <PlanBadge key={p.id} plan={p} />
            ))}
          </XStack>
        </YStack>
      ) : null}

      {m.features && m.features.length > 0 ? (
        <YStack gap="$2">
          <Text fontSize="$2" color="$color11" fontWeight="600">
            Features
          </Text>
          <XStack gap="$1.5" flexWrap="wrap">
            {m.features.map((f) => (
              <Text key={f} fontSize="$2" px="$2.5" py="$1" rounded="$3" bg="$color3" color="$color11">
                {f}
              </Text>
            ))}
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  )
}

/** One model row inside a family section — click for the full detail. */
function ModelRow({ m, brand, onOpen }: { m: CatalogEntry; brand: string; onOpen: () => void }) {
  const isDefault = modelId(m).toLowerCase() === DEFAULT_MODEL
  // Best published score for this model in the enso-bench corpus, or null when it
  // has never been benchmarked publicly.
  const bench = priorFor(modelId(m))?.intelligence ?? null
  return (
    <XStack
      items="center"
      gap="$2.5"
      px="$3"
      py="$2.5"
      rounded="$3"
      cursor="pointer"
      hoverStyle={{ bg: '$color3' }}
      onPress={onOpen}
    >
      {/* Family brand — every model in a family shares its header mark (Zen → Hanzo mark). */}
      <ProviderLogo provider={brand} size={26} />
      <YStack flex={1} minW={0} gap={1}>
        <XStack items="center" gap="$2" flexWrap="wrap">
          <Text fontSize="$3" color="$color12" numberOfLines={1}>
            {displayLabel(m)}
          </Text>
          {isDefault ? <Pill label="Default" tone="brand" /> : null}
          {/* Capability, from the catalog's own features — absent, not "no", when
              the upstream publishes nothing. */}
          {supportsVision(m) ? <Pill label="Vision" /> : null}
          {m.specs?.params ? (
            <Text fontSize="$1" color="$color10">
              {m.specs.params}
            </Text>
          ) : null}
        </XStack>
        {m.description ? (
          <Text fontSize="$1" color="$color10" numberOfLines={1}>
            {m.description}
          </Text>
        ) : null}
      </YStack>
      {/* Benchmark headline from the published prior corpus — an em-dash when the
          model has no published score. Never a zero, never a guess. */}
      <Text
        className={TNUM}
        fontSize="$2"
        color={bench == null ? '$color10' : '$color12'}
        width={48}
        text="right"
        display="none"
        $md={{ display: 'flex' }}
      >
        {bench == null ? '—' : bench.toFixed(1)}
      </Text>
      {/* Context column: hidden on phones (mobile-first) so rows never overflow. */}
      <Text className={TNUM} fontSize="$2" color="$color11" width={72} text="right" display="none" $md={{ display: 'flex' }}>
        {fmtContext(modelContext(m))}
      </Text>
      {/* Both sides of the price: in/out $ per Mtok, the two numbers a cost decision
          actually needs (output dominates reasoning traffic). */}
      <Text className={TNUM} fontSize="$2" color="$color12" width={72} $md={{ width: 96 }} text="right">
        {fmtPrice(m.pricing?.input)}
        <Text fontSize="$1" color="$color10">
          {' / '}
        </Text>
        {fmtPrice(m.pricing?.output)}
      </Text>
      <XStack width={72} $md={{ width: 96 }} justify="flex-end">
        {m.available ? <Pill label="● Live" tone="live" /> : <Pill label="Catalog" />}
      </XStack>
    </XStack>
  )
}

const PER_FAMILY_CAP = 8

/** One collapsible family section — header + nested model rows. */
function FamilySection({
  group,
  onOpen,
}: {
  group: FamilyGroup
  onOpen: (m: CatalogEntry) => void
}) {
  const [open, setOpen] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? group.models : group.models.slice(0, PER_FAMILY_CAP)
  const hidden = group.models.length - rows.length
  return (
    <YStack rounded="$4" borderWidth={1} borderColor="$borderColor" bg="$color1" overflow="hidden">
      <XStack
        items="center"
        gap="$3"
        px="$3.5"
        py="$3"
        cursor="pointer"
        hoverStyle={{ bg: '$color2' }}
        onPress={() => setOpen((v) => !v)}
      >
        <ProviderLogo provider={group.logo} size={30} />
        <YStack flex={1} minW={0} gap={1}>
          <Text fontSize="$5" fontWeight="800" color="$color12" numberOfLines={1}>
            {group.label}
          </Text>
          <Text className={TNUM} fontSize="$1" color="$color10">
            {group.models.length} model{group.models.length === 1 ? '' : 's'}
            {group.available > 0 ? ` · ${group.available} live` : ''}
          </Text>
        </YStack>
        {open ? <ChevronDown size={18} color="$color10" /> : <ChevronRight size={18} color="$color10" />}
      </XStack>

      {open ? (
        <YStack px="$1.5" pb="$2" borderTopWidth={1} borderColor="$borderColor">
          {rows.map((mo) => (
            <ModelRow key={modelId(mo)} m={mo} brand={group.logo} onOpen={() => onOpen(mo)} />
          ))}
          {hidden > 0 ? (
            <Button size="$2" chromeless self="flex-start" mt="$1" ml="$2" onPress={() => setShowAll(true)}>
              Show {hidden} more
            </Button>
          ) : showAll && group.models.length > PER_FAMILY_CAP ? (
            <Button size="$2" chromeless self="flex-start" mt="$1" ml="$2" onPress={() => setShowAll(false)}>
              Show less
            </Button>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  )
}

const Stat = ({ label, value, divider }: { label: string; value: string; divider?: boolean }) => (
  <YStack
    flex={1}
    gap={2}
    px="$4"
    py="$3"
    minW={120}
    borderLeftWidth={divider ? 1 : 0}
    borderColor="$borderColor"
  >
    <Text className={TNUM} fontSize="$7" fontWeight="800" color="$color12" letterSpacing={-0.5}>
      {value}
    </Text>
    <Text fontSize="$1" color="$color10">
      {label}
    </Text>
  </YStack>
)

/** A single shimmer bar (honest loading — never fabricated content). */
const Shimmer = ({ w, h = 12, r = 6 }: { w: number | string; h?: number; r?: number }) => (
  <div className="hz-skeleton" style={{ width: w, height: h, borderRadius: r }} />
)

/** Skeleton family cards — the designed loading state (Linear-grade, no spinner). */
function CatalogSkeleton() {
  return (
    <YStack gap="$2.5">
      {[0, 1, 2].map((s) => (
        <YStack key={s} rounded="$4" borderWidth={1} borderColor="$borderColor" bg="$color1" overflow="hidden">
          <XStack items="center" gap="$3" px="$3.5" py="$3">
            <div className="hz-skeleton" style={{ width: 30, height: 30, borderRadius: 8 }} />
            <YStack gap="$1.5">
              <Shimmer w={120} h={14} />
              <Shimmer w={72} h={9} />
            </YStack>
          </XStack>
          <YStack px="$3.5" py="$2.5" gap="$3" borderTopWidth={1} borderColor="$borderColor">
            {[0, 1, 2].map((r) => (
              <XStack key={r} items="center" gap="$2.5">
                <div className="hz-skeleton" style={{ width: 26, height: 26, borderRadius: 7 }} />
                <Shimmer w={180 - r * 24} h={12} />
                <YStack flex={1} />
                <Shimmer w={54} h={10} />
                <Shimmer w={60} h={10} />
              </XStack>
            ))}
          </YStack>
        </YStack>
      ))}
    </YStack>
  )
}

/** One tappable model chip — the family mark + the model's display name. */
function ModelChip({ m, onOpen }: { m: CatalogEntry; onOpen: () => void }) {
  return (
    <Button size="$2" icon={<ProviderLogo provider={familyOf(m).logo} size={15} />} onPress={onOpen}>
      {displayLabel(m)}
    </Button>
  )
}

/** Recent + Suggested — the reach-first chips above the full family list. Recents
 *  are the user's own trail; suggestions are one live rung per pinned family. An
 *  empty section renders nothing — never a fabricated chip. */
function ShortcutStrip({
  recents,
  suggested,
  onOpen,
}: {
  recents: CatalogEntry[]
  suggested: CatalogEntry[]
  onOpen: (m: CatalogEntry) => void
}) {
  if (!recents.length && !suggested.length) return null
  return (
    <XStack items="center" gap="$2" flexWrap="wrap">
      {recents.length ? (
        <Text fontSize="$1" color="$color10" fontWeight="500">
          Recent
        </Text>
      ) : null}
      {recents.map((m) => (
        <ModelChip key={modelId(m)} m={m} onOpen={() => onOpen(m)} />
      ))}
      {suggested.length ? (
        <Text fontSize="$1" color="$color10" fontWeight="500" ml={recents.length ? '$2' : undefined}>
          Suggested
        </Text>
      ) : null}
      {suggested.map((m) => (
        <ModelChip key={modelId(m)} m={m} onOpen={() => onOpen(m)} />
      ))}
    </XStack>
  )
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; err: ApiError }
  | { phase: 'ready'; models: CatalogEntry[] }

export function ModelCatalogModule(_props: { params: Record<string, string> }) {
  const router = useRouter()
  const [state, setState] = useState<LoadState>({ phase: 'loading' })
  const [plans, setPlans] = useState<Plan[]>([])
  const [selected, setSelected] = useState<CatalogEntry | null>(null)
  // The user's own view of this catalog, persisted with the rest of their
  // preferences — the catalog across a dozen families is a list you narrow once and
  // want to find narrowed the same way, on any device. It is never hidden state:
  // the bar renders the query and offers Reset the moment anything is active.
  const list = useList('models')
  const query = list.q

  const run = useCallback(() => {
    setState({ phase: 'loading' })
    fetchCatalog()
      .then((models) => setState({ phase: 'ready', models }))
      .catch((e) => setState({ phase: 'error', err: asApiError(e) }))
    // Plans are enrichment (tier badges); honest-empty on gate, never blocks.
    fetchPlans().then(setPlans)
  }, [])

  useEffect(() => {
    run()
  }, [run])

  const models = state.phase === 'ready' ? state.models : []
  const groups = useMemo(() => groupByFamily(models), [models])
  const visible = useMemo(() => filterFamilies(groups, query), [groups, query])

  // Opening a model records the use, so the Recent chips are the user's real
  // trail — the same trail chat writes when a turn is sent.
  const { recent, record } = useRecentModels()
  const openModel = useCallback(
    (m: CatalogEntry) => {
      record(modelId(m))
      setSelected(m)
    },
    [record],
  )
  const shortcuts = useMemo(() => {
    const byId = new Map(models.map((x) => [modelId(x).toLowerCase(), x]))
    // A recent id whose model left the catalog silently drops — honest absence.
    const recents = recent.map((id) => byId.get(id.toLowerCase())).filter((x): x is CatalogEntry => x !== undefined)
    return { recents, suggested: suggestedModels(groups, recents.map((x) => modelId(x))) }
  }, [models, groups, recent])

  const stats = useMemo(() => {
    const shown = totalModels(visible)
    const live = visible.reduce((n, g) => n + g.available, 0)
    return { families: String(visible.length), total: String(shown), live: String(live) }
  }, [visible])

  // Click-through detail — full specs/pricing/features + config actions.
  if (selected) {
    return <ModelDetailPanel m={selected} plans={plans} onBack={() => setSelected(null)} />
  }

  return (
    <>
      <PageHeader
        title="Models"
        subtitle="The same models you get in Hanzo Chat — the house-brand Zen family plus every third-party model the gateway serves (OpenAI, Claude, DeepSeek, Llama, and more)."
        actions={
          <XStack gap="$2" items="center" flexWrap="wrap">
            <Button size="$2" chromeless icon={<Boxes size={15} />} onPress={() => router.push('/providers')}>
              Providers
            </Button>
            <Button size="$2" icon={<RefreshCw size={15} />} onPress={run}>
              Refresh
            </Button>
          </XStack>
        }
      />

      {state.phase === 'error' ? (
        <ErrorState
          err={state.err}
          onRetry={run}
          copy={{
            notFound:
              'The model catalog (/v1/models) is not routed on this host yet. It appears automatically once the deployment proxies it through the gateway.',
          }}
        />
      ) : (
        <>
          {/* Search across all families — the ONE list bar, not a fourth search box. */}
          <Filters list={list} placeholder="Search models across every family…" />

          {/* Reach first: the user's recent models, then one suggestion per house/
              flagship family — hidden while searching (the query owns the page). */}
          {state.phase === 'ready' && !query ? (
            <ShortcutStrip recents={shortcuts.recents} suggested={shortcuts.suggested} onOpen={openModel} />
          ) : null}

          {state.phase === 'loading' ? (
            <CatalogSkeleton />
          ) : visible.length === 0 ? (
            <YStack p="$8" items="center" gap="$2">
              <Boxes size={26} color="$color9" />
              <Text fontSize="$3" color="$color10" text="center" maxW={320}>
                {query ? `No models match “${query}”.` : 'No chat models available on this deployment yet.'}
              </Text>
            </YStack>
          ) : (
            <YStack gap="$2.5">
              {visible.map((g, i) => (
                <FadeIn key={g.id} index={i} step={40}>
                  <FamilySection group={g} onOpen={openModel} />
                </FadeIn>
              ))}
            </YStack>
          )}

          {state.phase === 'ready' && visible.length > 0 ? (
            <XStack
              rounded="$4"
              borderWidth={1}
              borderColor="$borderColor"
              bg="$color1"
              mt="$2"
              flexWrap="wrap"
            >
              <Stat label="Families" value={stats.families} />
              <Stat label="Models" value={stats.total} divider />
              <Stat label="Available now" value={stats.live} divider />
            </XStack>
          ) : null}
        </>
      )}
    </>
  )
}
