/**
 * Product catalog — the single source of truth for the unified console.
 *
 * ONE list (`catalog`) describes every Hanzo product, whether it is an
 * in-console admin module (owns routes, rendered here) or an external surface
 * (owned by another service, opened in a tab). The nav shell, the catalog
 * overview, the discover interstitials, the favorites system, and the router all
 * render from this list, so surfacing a product = adding ONE `CatalogEntry` — no
 * shell/route/page edits.
 *
 * Orthogonal: an entry owns its identity + how it opens and knows nothing about
 * siblings. The catalog only composes them. `productModules` (the in-console
 * subset) is derived, so the router/match layer is unchanged.
 *
 * Taxonomy: the ten canonical "Open AI Cloud" categories — exact labels and
 * order — as the open-source equivalent of Google Cloud, plus an appended
 * `Async` category for durable orchestration (Tasks/Temporal; GCP Cloud
 * Tasks/Workflows). The first ten keep their exact order; `Async` is appended so
 * nothing is reordered. Each entry names the Google Cloud product it stands in
 * for (`gcp`), and carries
 * an honest enablement `status`: an in-console module that works (`enabled`), a
 * live external Hanzo surface (`external`), or a primitive that ships but has no
 * console surface yet (`soon`). No fabricated states.
 */
import type { ComponentType } from 'react'
import { Users,
  Building2,
  Percent,
  Upload,
  AppWindow,
  Accessibility,
  LifeBuoy,
  Brain,
  Server,
  Bot,
  Zap,
  Sparkles,
  Boxes,
  ListChecks,
  Cpu,
  Container,
  FunctionSquare,
  Radio,
  Box,
  Database,
  Key,
  HardDrive,
  FileText,
  Network,
  Waypoints,
  Trophy,
  Route,
  Globe,
  Cable,
  Spline,
  Shield,
  ShieldCheck,
  KeyRound,
  Fingerprint,
  Lock,
  ScrollText,
  Terminal,
  Package,
  Tags,
  Code2,
  Play,
  Code,
  Monitor,
  FolderGit2,
  Layers,
  Hammer,
  Rocket,
  GitBranch,
  BarChart3,
  Activity,
  LineChart,
  Bell,
  CreditCard,
  TrendingUp,
  Gauge,
  Tag,
  ArrowLeftRight,
  Wallet,
  Coins,
  Landmark,
  Gift,
  Handshake,
  BookOpen,
  MessageSquare,
  Search,
  KeySquare,
  SlidersHorizontal,
  Ruler,
  ClipboardList,
  Workflow,
  Megaphone,
  Target,
  Share2,
  NotebookPen,
  IdCard,
  Blocks,
  Store,
  Compass,
  Droplet,
  AlertTriangle,
  Cloud,
  FlaskConical,
  Webhook,
} from '@hanzogui/lucide-icons-2'

import { config, type BrandId, type ShellId } from '~/config'
import { ALWAYS_ON_PRODUCTS, filterBeta, filterEntitled, isLaunchProduct } from '~/lib/entitlements'
import { type ProductCategory, categoryOrder, categoriesForBrand, categoryInBrand } from './brand-scope'
import { shellFor, isProductShell } from './shell'
import { ProvidersModule } from '~/components/products/ProvidersModule'
import { ProviderAdminModule } from '~/components/products/ProviderAdminModule'
import { ProvidersBillingModule } from '~/components/products/admin/ProvidersBillingModule'
import { GrowthModule } from '~/components/products/admin/GrowthModule'
import { UsageCapsPromoModule } from '~/components/products/admin/UsageCapsPromoModule'
import { AiEconomicsModule } from '~/components/products/admin/AiEconomicsModule'
import { RoutingModule } from '~/components/products/admin/RoutingModule'
import { ModelsModule } from '~/components/products/ModelsModule'
import { RouterModule } from '~/components/products/RouterModule'
import { ApplicationsModule } from '~/components/products/ApplicationsModule'
import { PlatformAppsModule } from '~/components/products/PlatformAppsModule'
import { PlatformModule } from '~/components/products/PlatformModule'
import { StoreModule } from '~/components/products/store/StoreModule'
import { StoreDetail } from '~/components/products/store/StoreDetail'
import { MapModule } from '~/components/products/map/MapModule'
import { EmbeddingsModule } from '~/components/products/EmbeddingsModule'
import { KnowledgeModule } from '~/components/products/KnowledgeModule'
import { ChatModule } from '~/components/products/ChatModule'
import { BotModule } from '~/components/products/BotModule'
import { BotsConsole } from '~/components/products/BotsConsole'
import { AdminO11yModule } from '~/components/products/AdminO11yModule'
import { ResearchModule } from '~/components/products/ResearchModule'
import { InfraModule } from '~/components/products/admin/infra/InfraModule'
import { SaasModule } from '~/components/products/SaasModule'
import { MarketplaceModule } from '~/components/products/MarketplaceModule'
import { SearchModule } from '~/components/products/SearchModule'
import { TemplatesModule } from '~/components/products/TemplatesModule'
import { StudioModule } from '~/components/products/StudioModule'
import { PlansModule } from '~/components/products/PlansModule'
import { BillingModule } from '~/components/products/BillingModule'
import { AIAccountsModule } from '~/components/products/AIAccountsModule'
import { FinanceModule } from '~/components/products/FinanceModule'
import { CatalogModule } from '~/components/products/CatalogModule'
import { PlansCatalogModule } from '~/components/products/PlansCatalogModule'
import { UsageModule } from '~/components/products/UsageModule'
import { AiUsageModule } from '~/components/products/AiUsageModule'
import { ConnectionsModule } from '~/components/products/ConnectionsModule'
import { WalletModule } from '~/components/products/WalletModule'
import { IamModule } from '~/components/products/AdminModule'
import { EntitlementsAdminModule } from '~/components/products/EntitlementsAdminModule'
import { AuditModule } from '~/components/products/audit/AuditModule'
import { KmsModule } from '~/components/products/KmsModule'
import { StorageModule } from '~/components/products/StorageModule'
import { BaseModule } from '~/components/products/BaseModule'
import { RecordsModule } from '~/components/products/RecordsModule'
import { ClustersModule } from '~/components/products/ClustersModule'
import { TenantsModule } from '~/components/products/TenantsModule'
import { KubernetesModule } from '~/components/products/KubernetesModule'
import { TracesModule } from '~/components/products/TracesModule'
import { ObservationsModule } from '~/components/products/ObservationsModule'
import { UsersModule } from '~/components/products/UsersModule'
import { SessionsModule } from '~/components/products/SessionsModule'
import { ScoresModule } from '~/components/products/ScoresModule'
import { StatusModule } from '~/components/products/StatusModule'
import { MetricsModule } from '~/components/products/MetricsModule'
import { LuxNetworkModule } from '~/components/products/LuxNetworkModule'
import { DnsModule } from '~/components/products/DnsModule'
import { DomainsModule } from '~/components/products/DomainsModule'
import { CloudflareModule } from '~/components/products/CloudflareModule'
import { PlaygroundModule } from '~/components/products/PlaygroundModule'
import { PromptCreateModule, PromptMetricsModule, PromptsModule } from '~/components/products/PromptsModule'
import { EvalsModule } from '~/components/products/EvalsModule'
import { DatasetItemsModule, DatasetRunsModule, DatasetsModule } from '~/components/products/DatasetsModule'
import { resourceRoutes } from '~/components/products/ResourceModule'
import { overviewFor } from '~/components/products/overview/NativeOverview'
import { CategoryOverview } from '~/components/products/overview/CategoryOverview'
import {
  StoreProductsModule,
  StoreOrdersModule,
  StoreCustomersModule,
  StoreInventoryModule,
  StorePromotionsModule,
  StoreSettingsModule,
} from '~/components/products/commerce'
import { ApiKeysModule } from '~/components/products/ApiKeysModule'
import { SettingsModule } from '~/components/products/SettingsModule'
import { ScoreConfigsModule } from '~/components/products/ScoreConfigsModule'
import { AnnotationQueuesModule } from '~/components/products/AnnotationQueuesModule'
import { MemoryModule } from '~/components/products/MemoryModule'
import { TasksModule } from '~/components/products/TasksModule'
import { AttestationsModule } from '~/components/products/AttestationsModule'
import { ProjectsModule } from '~/components/products/ProjectsModule'
import { TrackerModule } from '~/components/products/TrackerModule'
import { AppsModule } from '~/components/products/AppsModule'
import { OraclesModule } from '~/components/products/OraclesModule'
import { IndexerModule } from '~/components/products/IndexerModule'
import { NetworksModule } from '~/components/products/NetworksModule'
import { NodesModule } from '~/components/products/NodesModule'
import { TradingModule } from '~/components/products/TradingModule'
import { MarketsModule } from '~/components/products/MarketsModule'
import { TokensModule } from '~/components/products/TokensModule'
import { SettlementModule } from '~/components/products/SettlementModule'
import { AlertsModule } from '~/components/products/AlertsModule'
// Admin operator compute boards (cross-tenant, admin-only) — kind='bot'|'machine'
// lenses over the datastore. Aliased to avoid the clash with the per-org customer
// `MachinesModule` (Compute › Machines, over visor-backed `/v1/machines`).
import { BotsModule, MachinesModule as AdminMachinesModule, ClustersModule as AdminClustersModule, FunctionsModule as AdminFunctionsModule } from '~/components/products/ComputeModule'
import { AnalyticsModule } from '~/components/products/AnalyticsModule'
import { LogsModule } from '~/components/products/LogsModule'
import { PipelinesModule } from '~/components/products/PipelinesModule'
import { ReleasesModule } from '~/components/products/ReleasesModule'
import { BuildsModule } from '~/components/products/BuildsModule'
import { EnvironmentsModule } from '~/components/products/EnvironmentsModule'
import { HsmModule } from '~/components/products/HsmModule'
import { AuthzModule } from '~/components/products/AuthzModule'
import { ServiceMeshModule } from '~/components/products/ServiceMeshModule'
import { ServiceMapModule } from '~/components/products/ServiceMapModule'
import { ErrorsModule } from '~/components/products/ErrorsModule'
import { SentryModule, SENTRY_TABS } from '~/components/products/SentryModule'
import { LoadBalancerModule } from '~/components/products/LoadBalancerModule'
import { VpcModule } from '~/components/products/VpcModule'
import { WebhooksModule } from '~/components/products/WebhooksModule'
import { EdgeModule } from '~/components/products/EdgeModule'
import { FunctionsModule } from '~/components/products/FunctionsModule'
import { ContainersModule } from '~/components/products/ContainersModule'
import { MachinesModule } from '~/components/products/MachinesModule'
import { GpusModule, GpusOverview } from '~/components/products/GpusModule'
import { FinetuningModule } from '~/components/products/FinetuningModule'
import { InferenceModule } from '~/components/products/InferenceModule'
import { AgentsModule } from '~/components/products/AgentsModule'
import { MissionControlModule } from '~/components/products/MissionControlModule'
import { CodeModule } from '~/components/products/CodeModule'
import { AutomationsModule } from '~/components/products/AutomationsModule'
import { CrmModule } from '~/components/products/CrmModule'
import { CompanyModule } from '~/components/products/CompanyModule'
import { CapTableModule } from '~/components/products/CapTableModule'
import { GuideModule } from '~/components/products/GuideModule'
import { MarketingModule } from '~/components/products/MarketingModule'
import { AdsModule } from '~/components/products/AdsModule'
import { SocialModule } from '~/components/products/SocialModule'
import { StartupsModule } from '~/components/products/StartupsModule'
import { CmsModule } from '~/components/products/CmsModule'
import { ErpModule } from '~/components/products/ErpModule'
import { HelpModule } from '~/components/products/HelpModule'
import { AccessibilityModule } from '~/components/products/AccessibilityModule'
import { TeamModule } from '~/components/products/TeamModule'
import { ProfileModule } from '~/components/products/ProfileModule'
import { livingOverviewModule } from '~/components/products/overview/living/LivingOverviewModule'
import { OrgIntegrationsModule } from '~/components/products/OrgIntegrationsModule'
import {
  DashboardsModule,
  ExperimentsModule,
  ScoreAnalyticsModule,
} from '~/components/products/ConsoleFeatureModule'
import { ReferralsModule } from '~/components/products/ReferralsModule'
import { ReferralsAdminModule } from '~/components/products/ReferralsAdminModule'
import { AffiliatesModule } from '~/components/products/AffiliatesModule'
import { AffiliatesAdminModule } from '~/components/products/AffiliatesAdminModule'
import { AuthorsModule } from '~/components/products/AuthorsModule'
import { AuthorsAdminModule } from '~/components/products/AuthorsAdminModule'
import { TreasuryAdminModule } from '~/components/products/TreasuryAdminModule'
import { FeatureGateModule } from '~/components/products/FeatureGateModule'

/**
 * Living overviews — the reusable, videogame-like overview (count-up KPIs, live
 * sparklines, streaming activity, throttled polling) declared as one config per
 * product in `overview/living/registry.ts`. `livingOverviewModule(id)` resolves the
 * config and renders the ONE `LivingOverview`. The platform overview + these product
 * overviews all render from that single component — adding one is a config, not UI.
 */
const OverviewDashboard = livingOverviewModule('overview')
// admin.hanzo.ai OVERLORD board — the god-view of EVERYTHING (platform-wide product
// health + tenants + usage across ALL orgs). GLOBAL-ADMIN ONLY (`admin: true` hides
// it from every customer; its loader is an all-orgs god view and `/v1/admin/overview`
// is server-gated). The operational god-view — distinct from Business (P&L).
const OverlordDashboard = livingOverviewModule('overlord')
// admin.hanzo.ai business board — the SaaS control surface. GLOBAL-ADMIN ONLY
// (the catalog entry is `admin: true`; its loader is an all-orgs god view and the
// `/v1/admin/overview` aggregate is itself server-gated).
const BusinessDashboard = livingOverviewModule('admin-business')
// admin.hanzo.ai finance board — the SaaS profitability hero (DO credit burn-down,
// spend, MRR, revenue, gross margin, runway). GLOBAL-ADMIN ONLY (`admin: true`; the
// `/v1/admin/finance` aggregate is server-gated by getAdminGate). Financial data is
// Hanzo-internal and must never reach a customer.
const FinanceDashboard = livingOverviewModule('finance')
const OpenEditionLiving = livingOverviewModule('open-edition')
// GPUs Overview is role-aware (admin → living overview, customer → visor catalog);
// the living-overview construction lives in GpusModule (GpusOverview) so this route
// is a plain component reference like every other.
import { ZeroTrustModule } from '~/components/products/ZeroTrustModule'
// Operator cockpit — the admin.hanzo.ai fleet management surfaces (admin: true) +
// the customer beta-features opt-in. Aliased to avoid name collisions with the
// per-tenant Commerce Customers / per-org Analytics products.
import { CustomersModule as FleetCustomersModule } from '~/components/products/admin/CustomersModule'
import { RevenueModule as FleetRevenueModule } from '~/components/products/admin/RevenueModule'
import { AnalyticsModule as RetentionModule } from '~/components/products/admin/AnalyticsModule'
import { EnablementModule as AdminEnablementModule } from '~/components/products/admin/EnablementModule'
// Aliased to avoid collisions with the customer `projects` product + a bare Grants name.
import { GrantsModule as FleetGrantsModule } from '~/components/products/admin/GrantsModule'
import { ProjectsModule as FleetProjectsModule } from '~/components/products/admin/ProjectsModule'
import { BetaFeaturesModule } from '~/components/products/BetaFeaturesModule'
// GitOps — the native ArgoCD replacement (SuperAdmin operator surface).
import { GitOpsModule } from '~/components/products/gitops/GitOpsModule'
import { DeployModule } from '~/components/products/deploy/DeployModule'
import { ContactModule } from '~/components/products/ContactModule'

/** A Hanzo GUI icon component (e.g. `Server` from `@hanzogui/lucide-icons-2`). */
export type ProductIcon = typeof Server

/** One screen inside an in-console product module. */
export type ProductRoute = {
  /** Path segment under the product, '' for the index. */
  path: string
  /** Rendered surface. Receives the matched route params. */
  component: ComponentType<{ params: Record<string, string> }>
}

/**
 * A declared sub-page in a product's level-2 nav (the Linear-style slide-in).
 *
 * A product declares its SPECIFIC sub-pages here (the meaningful tabs beyond the
 * index/Overview); the uniform base set — Overview · Settings · Status · Logs ·
 * Metrics — is auto-added by `productSubpages` so no product is a snowflake. The
 * Overview ('' index) is implicit and never declared. A declared sub-page whose
 * `slug` has no backing route (the module/route isn't merged yet) renders an
 * honest placeholder and is still a ⌘K jump target — never a 404, never a fake.
 */
export type ProductSubpage = {
  /** Path segment under the product (e.g. 'routing', 'queues'). Never '' — the
   *  index Overview is implicit. */
  slug: string
  /** Display label in the level-2 nav and the command palette. */
  label: string
  /** Optional icon (defaults per well-known base slug in `productSubpages`). */
  icon?: ProductIcon
  /**
   * Admin-only (global / Hanzo-managed) sub-page — hidden from a customer's
   * level-2 nav and the command palette, and rendered as an honest "managed by
   * Hanzo" notice if reached directly. Access is enforced server-side too. Used
   * for the shared-gateway config (e.g. Models › Routing) that customers read but
   * do not administer.
   */
  admin?: boolean
}

/**
 * The canonical Hanzo Cloud category axis — the top-level nav sections, in exact
 * order. The console nav, catalog overview, command palette, and discover screens all
 * read this one taxonomy; `catalogByCategory` skips empty groups.
 *
 * Canonical axis (2-level nav, category → product → sub-pages):
 *   AI · Compute · Training · Data · Network · Security · Observe · Platform ·
 *   Dev · Web3 · Apps · Settings
 *
 * Decisions:
 *   - `Deploy` was renamed `Platform` (the ship-and-run pipeline: Projects,
 *     Environments, Builds, Registry, Releases, Pipelines).
 *   - `Training` is a new group (Fine-tuning), split out
 *     of AI so model *building* is its own axis.
 *   - `Compute` is the infra axis: Kubernetes, Containers, Tasks, Functions,
 *     GPUs, Machines, Edge, Clusters, Applications. `Tasks` (durable workflows)
 *     REPLACES the retired `Jobs` entry; the `Async` group is gone.
 *   - `Settings` is a new group for org/account administration (Team, Settings,
 *     Profile).
 *   - `Dev` and `Web3` are retained (they hold real developer + on-chain
 *     products); the axis above lists the primary groups, not an exclusive set.
 */
// ProductCategory + categoryOrder + the pure per-brand scope live in
// ./brand-scope (dependency-free, unit-tested in registry-brand.test.ts).
// Re-exported here so existing importers of the registry are unchanged.
export type { ProductCategory } from './brand-scope'
export {
  categoryOrder,
  BRAND_CATEGORIES,
  categoriesForBrand,
  categoryInBrand,
  entryInBrandScope,
  categorySlug,
  categoryFromSlug,
  CATEGORY_SUMMARY,
} from './brand-scope'
import { entryInBrandScope } from './brand-scope'

/**
 * Enablement state — one honest value: every catalog entry is live. An entry
 * either opens straight in (a bespoke admin surface or a native product overview)
 * or, for a deployed external app, launches its own domain — but it is always
 * usable. There is no "coming soon" state: an unfinished primitive is simply not
 * listed, never shown as a dead placeholder.
 *
 * `external` is NOT a status — it is a `kind` (the shape discriminant on
 * `CatalogEntry`), orthogonal to enablement: a launch tile for a deployed external
 * app (the Lux/Zoo chain-app suite) is `status: 'enabled'` (it's live) with
 * `kind: 'external'` (it opens in a new tab). How a live entry OPENS (native route
 * vs. external launch) is the kind, not this.
 */
export type ProductStatus = 'enabled'

type CatalogBase = {
  /** Stable id and base path segment, e.g. 'vector'. */
  id: string
  /** Display label (the canonical menu name). */
  label: string
  /** Display icon. */
  icon: ProductIcon
  /** One-line description for the catalog + nav. */
  description: string
  /** The Google Cloud product this is the open equivalent of, shown as a subtitle. */
  gcp?: string
  /** Category grouping. */
  category: ProductCategory
  /** Enablement state — always 'enabled'; every listed entry is live. */
  status: ProductStatus
  /** Source repo for the product, e.g. 'hanzoai/vector'. Only set where it exists. */
  repo?: string
  /** Canonical docs deep link (docs.hanzo.ai/<slug>); falls back to the docs root. */
  docs?: string
  /** Admin-gated surface (shown with a lock hint; access enforced server-side). */
  admin?: boolean
  /**
   * Beta (early-access) product — hidden from every nav, palette, discovery
   * panel and search until the caller's ORG holds the `apps` beta through the
   * enablement plane (kind `feature`, id `apps`) — the same self-service
   * opt-in the Beta features module manages. Superadmins always see them, and
   * the gate fails CLOSED: no enablement read, no beta surfaces.
   */
  beta?: boolean
  /**
   * Per-brand scope — the brands whose console shows this entry (`entryInBrandScope`).
   * OMIT for a brand-agnostic entry (the default: shown on every brand its category
   * admits — every in-console product). SET it only for a brand-specific entry that
   * must not cross-leak inside a shared category — e.g. the Lux chain-app launch
   * tiles are `['hanzo', 'lux']` and the Zoo ones `['hanzo', 'zoo']`, so both sit in
   * the shared Web3 category yet lux.cloud shows only Lux and zoo.cloud only Zoo
   * (hanzo, the umbrella, shows the full suite).
   */
  brands?: BrandId[]
  /**
   * Product-shell scope — the console FACE this entry belongs to. OMIT for a normal
   * console product (the default: shown in the full console, NOT in a product face).
   * SET it to bind an entry to a single face (`sentry` → the sentry.<brand> Sentry
   * shell): a `shell`-scoped entry is HIDDEN from the full console nav and shown
   * ONLY inside its face (the DRY twin of the billing-only Billing Center, which is
   * a normal entry surfaced alone by the `billing` shell — see `config.shell`).
   * Orthogonal to `brands`.
   */
  shell?: ShellId
  /**
   * The product's SPECIFIC level-2 sub-pages (beyond Overview + the uniform base
   * set, which `productSubpages` auto-adds). Only meaningful for `module` kinds.
   * Omit for a single-screen product — it still gets Overview + the base set.
   */
  subpages?: ProductSubpage[]
  /**
   * What the product calls its own index ('' route) in the level-2 nav. Defaults
   * to "Overview". Set it where the index is a NAMED surface rather than a summary
   * — Models' index is the Catalog, Tasks' is Workflows, Team's is Members — so the
   * one level-2 nav reads the way the product does. This is the ONLY place that
   * name lives; the nav and the module both read it here.
   */
  indexLabel?: string
}

/**
 * A catalog entry is one of two honest shapes, discriminated on `kind`:
 *
 *  - `module`   : an in-console surface that OWNS its routes. Every Hanzo Cloud
 *                 product is this — a bespoke admin surface OR a native overview
 *                 (`routes: overviewRoutes(id)`). A Hanzo product the console
 *                 doesn't yet deep-manage still opens IN the console (a real page
 *                 with live health + inline docs), never a bounce to another
 *                 domain. This is the ONLY shape for anything Hanzo runs.
 *
 *  - `external` : a LAUNCH TILE for a standalone app that genuinely lives at its
 *                 own domain and is owned by another product — the deployed Lux /
 *                 Zoo chain-app suite (Explorer, Exchange, Bridge, Faucet, Safe,
 *                 DEX, Wallet). These are NOT Hanzo control-plane products and are
 *                 NOT rebuilt here; the tile opens `href` in a new tab. It owns no
 *                 route, no sub-pages, and no overview — `openProduct` launches it,
 *                 and every `kind !== 'module'` guard (productSubpages,
 *                 resolveProductView, destinationsFor, isAdminView, productModules)
 *                 fails closed so it never manufactures a dead in-console route.
 *
 * Both share `CatalogBase`, so the nav / ⌘K / category pages render and
 * open either uniformly. The discriminant keeps consumers exhaustive.
 */
export type CatalogEntry =
  | (CatalogBase & { kind: 'module'; routes: ProductRoute[] })
  | (CatalogBase & { kind: 'external'; href: string })

// docs.hanzo.ai serves the Fumadocs site under the /docs base path
// (docs.hanzo.ai/docs/<slug>), so product deep links must include it — a bare
// docs.hanzo.ai/<slug> 404s.
const DOCS = 'https://docs.hanzo.ai/docs'

/**
 * Docs deep links for products whose `docs` slug differs from `${DOCS}/<id>`.
 * These feed the `docs` FIELD (the small secondary "Full docs" reference on the
 * native overview) — NOT an external product link-out; every product opens IN
 * the console. Products whose docs slug matches their id use `${DOCS}/<id>` inline.
 */
const ext = {
  dns: `${DOCS}/dns`,
  cdn: `${DOCS}/cdn`,
  cli: `${DOCS}/cli`,
  sdk: `${DOCS}/sdk`,
  api: `${DOCS}/api`,
  ide: `${DOCS}/code`,
  desktop: `${DOCS}/desktop`,
} as const

/**
 * The native product overview for a product that has no bespoke admin surface yet.
 * ONE component (`NativeOverview`, driven by a pure `OverviewSpec` in overview/
 * spec.ts) renders a real in-console page — header, live health from the platform
 * apps inventory, key facts, native actions, and INLINE docs — so the console has
 * ZERO external link-outs (a product opens IN the console, never in another tab).
 * DRY twin of `soonRoutes`: a native-overview leaf is just `routes: overviewRoutes(id)`.
 */
const overviewRoutes = (id: string): ProductRoute[] => [{ path: '', component: overviewFor(id) }]

/**
 * The Hanzo product catalog — the open-source Google Cloud, ten categories.
 * In-console modules render here; external surfaces open in a tab. Every real
 * working module is preserved; everything else is an honest `external` or `soon`.
 */
export const catalog: CatalogEntry[] = [
  // ── Observe — the usage/spend dashboard home (also rendered at '/') ───
  {
    id: 'overview',
    label: 'Overview',
    icon: Gauge,
    description: 'Real-time usage, performance, and spend across your AI workloads.',
    gcp: 'Cloud overview',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: OverviewDashboard }],
  },
  {
    // AI Accounts — link your AI provider accounts (OpenAI/Codex, Anthropic/Claude, …)
    // and see UNIFIED usage across desktop/mobile/web/CLI in one place, beside the org's
    // own Hanzo lane. Overview reads the merged `/v1/ai-accounts/usage` feed (external
    // providers via the headless @hanzo/usage engine, Hanzo via the real commerce
    // ledger); Accounts links a provider by pasting an API key / OAuth token / cookie
    // header, sealed server-side (never in the browser). The `accounts` subpage lands
    // `/ai-accounts/accounts` on the connect tab.
    id: 'ai-accounts',
    label: 'AI Accounts',
    icon: Boxes,
    description: 'Link your AI provider accounts and see unified usage across desktop, mobile, web, and CLI.',
    gcp: 'Connected accounts',
    category: 'AI',
    status: 'enabled',
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [
      { path: '', component: AIAccountsModule },
      { path: ':tab', component: AIAccountsModule },
    ],
    subpages: [
      { slug: 'machines', label: 'Machines' },
      { slug: 'routing', label: 'Routing' },
      { slug: 'accounts', label: 'Accounts' },
    ],
  },
  {
    // admin.hanzo.ai OVERLORD board — the top-level god-view of EVERYTHING: every
    // Hanzo product's live health across the WHOLE platform (all orgs), tenant count,
    // and platform-wide usage/spend/top-models. GLOBAL-ADMIN ONLY (`admin: true` hides
    // it from every customer's nav/palette; the loader is an all-orgs god view
    // over the operator inventory + the server-gated `/v1/admin/overview` aggregate,
    // with an honest fallback to the real usage ledger — never blank, never fabricated).
    // The operational god-view; Business/Finance are the P&L lenses. Reuses the ONE
    // LivingOverview — this entry is a config, not a new surface.
    id: 'overlord',
    label: 'Overlord',
    icon: Radio,
    description: 'God-view of the whole platform — every product’s health, tenants, and usage across all orgs.',
    gcp: 'Cloud console (org-wide)',
    category: 'Observe',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: OverlordDashboard }],
  },
  {
    // admin.hanzo.ai BUSINESS board — the SaaS control surface for running the
    // business (MRR/revenue, usage & cost, active orgs/customers, top agents/bots
    // by cost, plan mix, fleet health). GLOBAL-ADMIN ONLY (`admin: true` hides it
    // from every customer's nav/palette; the loader is an all-orgs god
    // view and `/v1/admin/overview` is server-gated). Reuses the ONE LivingOverview.
    id: 'business',
    label: 'Business',
    icon: TrendingUp,
    description: 'MRR, revenue, usage & cost, customers, and top agents across the whole platform.',
    gcp: 'Cloud Billing overview',
    category: 'Billing',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: BusinessDashboard }],
  },
  {
    // admin.hanzo.ai FINANCE board — the SaaS profitability hero: DigitalOcean
    // credit burn-down (our primary ~$40k venue), month-to-date spend, MRR, total
    // revenue, gross margin %, runway, and a health verdict. GLOBAL-ADMIN ONLY
    // (`admin: true` hides it from every customer's nav/palette + the
    // catch-all renders a managed notice for a non-admin; the `/v1/admin/finance`
    // aggregate is server-gated by `getAdminGate`, so financial data never reaches a
    // customer). Reuses the ONE LivingOverview — this is a config, not a new surface.
    id: 'finance',
    label: 'Finance',
    icon: Coins,
    description: 'DigitalOcean credit burn-down, spend, revenue, gross margin, and runway across the platform.',
    gcp: 'Cloud Billing / FinOps',
    category: 'Billing',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: FinanceDashboard }],
  },
  {
    // admin.hanzo.ai CATALOG & PRICING — the CMS editor for the platform product +
    // pricing catalog (commerce `catalog-entry`, the SoT: the 17 infra tiers +
    // every product surface docs/pricing/the console read from). A filterable table
    // + create/edit form over the SuperAdmin CRUD (/v1/catalog/entries); an edit
    // here flows to the live pricing pages (the pricing service reads the same rows
    // via GET /v1/commerce/catalog). GLOBAL-ADMIN ONLY (`admin: true` hides it from
    // every customer; commerce's requireSuperAdmin (owner=="admin") is the
    // authoritative server-side gate, so catalog cost/margin never reach a customer).
    id: 'catalog',
    label: 'Catalog & Pricing',
    icon: Tags,
    description: 'Edit the platform product and pricing catalog — infra tiers, plans, and every product surface.',
    gcp: 'Cloud Catalog',
    category: 'Observe',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/commerce',
    kind: 'module',
    routes: [{ path: '', component: CatalogModule }],
  },
  {
    // admin.hanzo.ai SUBSCRIPTION PLANS — the CMS editor for the platform plan authority
    // (commerce `models/plan`, the SoT for subscription/DNS pricing that GET
    // /v1/billing/plans and the internal-ledger renewal charge read). A filterable table
    // + create/edit form over the SuperAdmin CRUD (/v1/plans/entries). LIVE BILLING
    // CONTROL: a plan's monthly price is the real renewal charge — the sibling of the
    // Catalog editor. GLOBAL-ADMIN ONLY (`admin: true` hides it from every customer;
    // commerce's requireSuperAdmin (owner=="admin") is the authoritative server-side gate).
    id: 'plan-catalog',
    label: 'Subscription Plans',
    icon: CreditCard,
    description: 'Edit the platform subscription and DNS plan authority — prices, tiers, and features.',
    gcp: 'Cloud Billing plans',
    category: 'Observe',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/commerce',
    kind: 'module',
    routes: [{ path: '', component: PlansCatalogModule }],
  },
  {
    // admin.hanzo.ai LAUNCH CONTROL — the access-governance cockpit: a Services
    // board (per-service waitlist-mode toggle — remove the waitlist one service at
    // a time) + a Pending-Users approval queue (approve/reject off the waitlist,
    // reusing IAM iam#104). ONE registry (cloud `clients/featuregate`), ONE approval
    // API — no per-app duplication. GLOBAL-ADMIN ONLY (`admin: true` hides it from
    // every customer's nav/palette; `/v1/admin/services*` is server-gated
    // by getAdminGate and the pending queue rides the global-admin /admin/iam proxy,
    // so access control never reaches a customer).
    id: 'launch-control',
    label: 'Launch Control',
    icon: Rocket,
    description: 'Remove the waitlist from hosted services one at a time, and approve users off the waitlist.',
    gcp: 'Feature flags / Access control',
    category: 'Security',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: FeatureGateModule }],
  },
  {
    // admin.hanzo.ai FLEET OBSERVABILITY board — the cross-org o11y god view:
    // fleet requests/tokens/cost/latency/errors + log volume, usage & log
    // timeseries, and top orgs/models/services leaderboards, all aggregated across
    // EVERY tenant from the ONE datastore. GLOBAL-ADMIN ONLY (`admin: true` hides it
    // from every customer's nav/palette; the `/v1/admin/o11y` aggregate is
    // server-gated by getAdminGate, so cross-tenant telemetry never reaches a
    // customer). The un-org-scoped twin of the per-org console o11y.
    id: 'fleet-o11y',
    label: 'Fleet Observability',
    icon: Activity,
    description: 'Cross-org requests, tokens, cost, latency, errors, logs and traces across the whole platform.',
    gcp: 'Cloud Monitoring (fleet)',
    category: 'Observe',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: AdminO11yModule }],
  },
  {
    // Research — the R&D EVIDENCE board (HIP-0512 §"Hanzo Research"): the falsifiable-
    // experiment corpus every product self-logs to /v1/research (kernel-perf, benchmark,
    // training, ablation, policy-eval) with first-class proofs AND refutations — a totals
    // band, a per-kind facet, the verdict ledger, and the "don't re-chase" refutation
    // highlight. GLOBAL-ADMIN ONLY (`admin: true` hides it from every customer's nav/
    // palette); the `research` head is org-scoped by the Bearer owner, so a
    // customer only ever reaches their OWN corpus, never Hanzo's platform R&D.
    id: 'research',
    label: 'Research',
    icon: FlaskConical,
    description: 'Falsifiable R&D experiments across the platform — every proof and every refutation, first-class.',
    gcp: 'Vertex AI Experiments',
    category: 'Observe',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: ResearchModule }],
  },
  {
    // admin.hanzo.ai INFRASTRUCTURE board — the DigitalOcean FLEET cockpit: droplets,
    // block-storage volumes, DOKS clusters and load balancers, what each costs per
    // month, and what is reclaimable. GLOBAL-ADMIN ONLY (`admin: true` hides it from
    // every customer; the `/v1/admin/infra` aggregate is server-gated by getAdminGate).
    //
    // This is INFRASTRUCTURE — the machines we rent from DigitalOcean. It is DISTINCT
    // from the compute-worker "Fleet" entries (`fleet-o11y` telemetry, `bots`/`vms`
    // compute-analytics), which lens the datastore's per-org compute events. Different
    // nouns, different backends: do not merge them.
    //
    // It SUBSUMES the former `block-storage` board, which listed the same DO volumes
    // with fill % beside this one's inventory of them — one noun, two boards. The two
    // backends answer different questions about the same object (this one knows what
    // is REFERENCED and therefore safe to delete; block-storage knows how FULL it is),
    // so the volumes tab reads both and shows one row with a Fill column.
    id: 'infra',
    label: 'Infrastructure',
    icon: Server,
    description: 'DigitalOcean fleet — droplets, block-storage volumes (with fill % and near-full warnings), DOKS clusters and load balancers, with monthly cost and what is safely reclaimable.',
    gcp: 'Compute Engine / Persistent Disk',
    category: 'Platform',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [
      { path: '', component: InfraModule },
      { path: ':tab', component: InfraModule },
    ],
    subpages: [
      { slug: 'clusters', label: 'Clusters' },
      { slug: 'nodes', label: 'Nodes' },
      { slug: 'volumes', label: 'Volumes' },
      { slug: 'balancers', label: 'Load balancers' },
      { slug: 'audit', label: 'Audit' },
    ],
  },
  {
    // admin.hanzo.ai SAAS METRICS board — the whole-business money god view: MRR/ARR,
    // MRR by plan category, subscription mix (per plan, trials, seats, recent
    // create/cancel events), metered pay-as-you-go revenue, and top customers by
    // revenue — computed IN commerce (the money system of record) from ONE cross-org
    // walk. The AI panel composes the SAME fleet o11y aggregate (never a fork).
    // GLOBAL-ADMIN ONLY (`admin: true` hides it from every customer; the
    // `/v1/commerce/metrics/saas` aggregate is server-gated by getAdminGate).
    id: 'saas-metrics',
    label: 'SaaS Metrics',
    icon: TrendingUp,
    description: 'MRR/ARR, subscription mix, metered revenue, and top customers across the whole platform.',
    gcp: 'Cloud Billing (SaaS)',
    category: 'Billing',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: SaasModule }],
  },
  {
    // admin.hanzo.ai USAGE CAPS & PROMO — the platform config surface for two levers:
    // the single plan PROMO (percent-off applied to paid plans, over `/v1/admin/promos`)
    // and cross-tenant CAP oversight/override (list/create/edit/delete any org's usage
    // caps over `/v1/admin/caps?org=<slug>`). GLOBAL-ADMIN ONLY (`admin: true` hides
    // it from every customer's nav/palette; both surfaces are server-gated by
    // getAdminGate behind `/admin/aggregate`). A config surface (not money-moving) — the
    // caps model reuses the tenant SpendAlert primitive, so `budgets-logic` is shared, no fork.
    id: 'usage-caps-promo',
    label: 'Usage Caps & Promo',
    icon: Gift,
    description: 'Set the platform plan promo, and oversee or override any organization’s usage caps.',
    gcp: 'Billing budgets / Promotions',
    category: 'Billing',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: UsageCapsPromoModule }],
  },
  {
    // admin.hanzo.ai CUSTOMERS board — the operator cockpit: the live fleet customer
    // list (incl. new self-serve signups), one-customer detail, and the AUDITED
    // management actions (grant credit, suspend/reactivate). GLOBAL-ADMIN ONLY
    // (`admin: true`; the `/v1/admin/customers*` aggregate is server-gated by
    // getAdminGate). Real commerce + IAM data; NO card data, no API-key values.
    id: 'fleet-customers',
    label: 'Customers',
    icon: Users,
    description: 'Every organization on the platform — balances, usage, keys, access. Grant credit, suspend, reactivate.',
    gcp: 'Cloud Billing accounts',
    category: 'Billing',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: FleetCustomersModule }],
  },
  {
    // admin.hanzo.ai REVENUE board — the fleet money lens (balances, spend, MRR,
    // ARPU, per-customer). GLOBAL-ADMIN ONLY; orthogonal to Finance (COGS/margin).
    id: 'fleet-revenue',
    label: 'Revenue',
    icon: Coins,
    description: 'Balances held, realized spend, MRR, ARPU, and per-customer revenue across the fleet.',
    gcp: 'Cloud Billing revenue',
    category: 'Billing',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: FleetRevenueModule }],
  },
  {
    // admin.hanzo.ai GRANTS board — the fleet credit-grant ledger + issuance (comps,
    // welcome/starter, support). GLOBAL-ADMIN ONLY (`admin: true` hides it from every
    // customer; the `/v1/admin/grants` aggregate is server-gated by getAdminGate). The
    // grant `source` is Trial (non-cash comp) or Prepaid (real money). Real commerce data.
    id: 'fleet-grants',
    label: 'Grants',
    icon: Gift,
    description: 'Every credit grant issued across the platform — comps, welcome/starter, support. Issue new grants.',
    gcp: 'Cloud Billing credits',
    category: 'Billing',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: FleetGrantsModule }],
  },
  {
    // admin.hanzo.ai PROJECTS board — the cross-org "what is deployed" view: every org's
    // apps across all clusters (health, cluster, live URL, drift). READ-ONLY. GLOBAL-ADMIN
    // ONLY (`admin: true`). A lens over the EXISTING global apps inventory (PlatformApi.apps
    // → /v1/apps) — no new backend surface, nothing fabricated. Drill by org via the filter.
    id: 'fleet-projects',
    label: 'Projects',
    icon: FolderGit2,
    description: 'Every org’s deployed apps across all clusters — health, cluster, and live URL. Read-only.',
    gcp: 'Cloud Deploy (fleet)',
    category: 'Platform',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: FleetProjectsModule }],
  },
  {
    // admin.hanzo.ai ANALYTICS board — native SaaS analytics: cohort retention,
    // growth, churn, DAU/WAU/MAU, revenue/ARPU. GLOBAL-ADMIN ONLY. Real (IAM
    // signups + commerce usage ledger); honest-empty via a `computed` map, never a
    // fabricated curve.
    id: 'retention',
    label: 'Analytics',
    icon: LineChart,
    description: 'Cohort retention, growth, churn, active customers, and revenue analytics across the customer base.',
    gcp: 'Analytics · SaaS',
    category: 'Observe',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: RetentionModule }],
  },
  {
    // admin.hanzo.ai ENABLEMENT board (#30/#31) — set models/providers/features
    // off · beta · ga across the fleet, grant betas to orgs. GLOBAL-ADMIN ONLY; the
    // per-org self-service opt-in is the customer Beta-features surface below.
    id: 'enablement',
    label: 'Enablement',
    icon: SlidersHorizontal,
    description: 'Turn models, providers, and features off · beta · ga across the fleet, and grant betas to orgs.',
    gcp: 'Feature management',
    category: 'Observe',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: AdminEnablementModule }],
  },
  {
    // Customer BETA FEATURES — the self-service opt-in (NOT admin). Any signed-in
    // user enables/disables the betas their org can access; scoped server-side to
    // the caller's validated org (can't bypass off, can't touch global state).
    id: 'beta-features',
    label: 'Beta features',
    icon: Activity,
    description: 'Enable early-access models and features for your organization.',
    gcp: 'Preview features',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: BetaFeaturesModule }],
  },
  {
    // admin.hanzo.ai BOTS board — the SaaS operator view of every @hanzo/bot agent
    // booted across the platform (kind='bot'), and its spend, grouped
    // org → app → project. GLOBAL-ADMIN ONLY (`admin: true` hides it from every
    // customer's nav/palette; the `/v1/admin/compute` datastore aggregate is
    // server-gated by `getAdminGate`). Reads ONLY the unified datastore —
    // one cross-tenant GROUP BY, never a per-tenant fan-out (the tenant-data-hierarchy
    // invariant). Honest-empty until the compute-events emitter lands.
    id: 'bots',
    label: 'Bots',
    icon: Bot,
    description: 'Every @hanzo/bot agent booted across the platform, and its spend — grouped org → app → project.',
    gcp: 'Fleet analytics · bots',
    category: 'Apps',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: BotsModule }],
  },
  {
    // admin.hanzo.ai MACHINES board — the operator view of raw compute (kind='machine')
    // visor opens across EVERY org, and its spend, grouped org → app → project. The
    // CROSS-TENANT operator lens (id `vms` — the per-org customer `machines` entry is a
    // different, non-admin surface over visor-backed `/v1/machines`). GLOBAL-ADMIN ONLY,
    // same datastore aggregate as Bots (`?kind=machine`). Honest-empty until wired.
    id: 'vms',
    label: 'Machines',
    icon: Boxes,
    description: 'Raw compute machines visor opens across every org, and their spend — grouped org → app → project.',
    gcp: 'Fleet analytics · machines',
    category: 'Compute',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: AdminMachinesModule }],
  },
  {
    // admin.hanzo.ai CLUSTERS board — the operator view of every DOKS cluster visor
    // manages across EVERY org (kind='cluster'), grouped org → app → project. Node
    // pools (kind='nodepool') carry the compute cost and nest here as the emitter
    // lands. Distinct from the customer `clusters` product (per-org DOKS ops). GLOBAL-
    // ADMIN ONLY, same datastore aggregate (`?kind=cluster`). Honest-empty until
    // visor's cluster/nodepool emitters + the cloud read land.
    id: 'cluster-fleet',
    label: 'Clusters',
    icon: Network,
    description: 'Every DOKS cluster visor manages across every org — grouped org → app → project.',
    gcp: 'Fleet analytics · clusters',
    category: 'Compute',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: AdminClustersModule }],
  },
  {
    // admin.hanzo.ai FUNCTIONS board — the operator view of serverless functions
    // across EVERY org (kind='function'), grouped org → app → project. Distinct from
    // the customer `functions` product. GLOBAL-ADMIN ONLY, same datastore aggregate
    // (`?kind=function`). Honest-empty until a functions runtime emits compute events
    // (hanzo/functions is upstream Fission with no tenant attribution today).
    id: 'function-fleet',
    label: 'Functions',
    icon: FunctionSquare,
    description: 'Every serverless function invoked across every org — grouped org → app → project.',
    gcp: 'Fleet analytics · functions',
    category: 'Compute',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: AdminFunctionsModule }],
  },
  // ── AI ───────────────────────────────────────────────────────────────
  {
    // Catalog-first: the default tab is the LIVE model list (the ~49 Zen models),
    // routing policy is the secondary "Routing" tab. Retires the old empty-by-default
    // trap (the separate "Model Catalog" entry is gone — this IS it).
    id: 'models',
    label: 'Models',
    icon: Brain,
    description: 'Browse the live model catalog and configure routing policy.',
    gcp: 'Model Garden',
    category: 'AI',
    status: 'enabled',
    repo: 'hanzoai/ai',
    kind: 'module',
    routes: [
      { path: '', component: ModelsModule },
      { path: ':tab', component: ModelsModule },
      { path: 'routing/:name', component: ModelsModule },
    ],
    // Models is a CUSTOMER surface — everyone browses the live catalog, the
    // published benchmark leaderboard, and their OWN org's blend (which models the
    // Enso tiers form over). The routing POLICY, though, is admin-only
    // shared-gateway config (hidden from a customer's sub-nav; graceful notice if
    // reached directly).
    // The index is the live Catalog, not a summary — the one level-2 nav says so.
    indexLabel: 'Catalog',
    subpages: [
      { slug: 'leaderboard', label: 'Leaderboard', icon: Trophy },
      { slug: 'blend', label: 'Blend', icon: Boxes },
      { slug: 'routing', label: 'Routing', icon: Waypoints, admin: true },
    ],
  },
  {
    // The org-user AI Usage & Training surface — the customer face of the virtual
    // `auto`/`zen-router` model, in three tabs:
    //   Overview — routing observability + TRAINING status over `GET /v1/router/stats`
    //     (org-scoped): cost saved (a blended $/MTok proxy), a quality proxy, the
    //     per-task model mix, the last-retrain gate verdict, and the opt-in
    //     training-contribution toggle (the toggle lives ONLY here).
    //   Usage    — the org's AI usage: native Hanzo `GET /v1/get-cloud-usages` +
    //     imported connected-provider usage, via the shared `<AiUsagePanels>` that
    //     the `ai-metrics` module also renders (one usage implementation, DRY).
    //   Policy   — the org's own task→model-pool prefer table + cost ceiling over
    //     `/v1/router/policy` (GET read + PUT write).
    // All org-admin gated + self-scoped server-side (org > "*" > conf per task key).
    // DISTINCT from the two routing surfaces beside it: `models`' admin "Routing" tab
    // flips PLATFORM ModelRoute config, and `ai-accounts`' Routing tab is the user's
    // smart-routing on/off preference — this one is the ORG's own usage + policy + stats.
    id: 'router',
    label: 'AI Usage & Training',
    icon: Waypoints,
    description: 'See all your org’s AI usage (requests, tokens, spend, per-model), track training contribution and routing quality, and configure task pools and cost ceiling.',
    gcp: 'Vertex AI (model routing)',
    category: 'AI',
    status: 'enabled',
    repo: 'hanzoai/ai',
    kind: 'module',
    routes: [
      { path: '', component: RouterModule },
      { path: ':tab', component: RouterModule },
    ],
    subpages: [
      { slug: 'usage', label: 'Usage' },
      { slug: 'policy', label: 'Policy' },
    ],
  },
  {
    // Admin-only: providers + credentials are shared-gateway config managed by
    // Hanzo (the cloud `get/add/update-provider` endpoints require a platform
    // admin — a customer org gets 403). Hidden from a customer's nav; reaching it
    // directly shows an honest "managed by Hanzo" notice, never a red error.
    id: 'providers',
    label: 'Providers',
    icon: Server,
    description: 'Model, storage, and embedding providers and credentials.',
    category: 'AI',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/ai',
    kind: 'module',
    routes: [
      { path: '', component: ProvidersModule },
      { path: ':name', component: ProvidersModule },
    ],
  },
  {
    // admin.hanzo.ai AI-PROVIDER control board — the platform-wide management table
    // for the shared-gateway upstream providers (do-ai, openrouter, fireworks,
    // openai-direct, zen): enable/disable each, set the single primary, and see model
    // count + key-present + derived health. GLOBAL-ADMIN ONLY (`admin: true` hides it
    // from every customer's nav/palette; the catch-all renders a managed
    // notice for a non-admin, and `/v1/admin/providers` is server-gated by
    // `getAdminGate`). DISTINCT from the customer `providers` entry above (the model
    // catalog browser + BYOK per-org CRUD) — this one flips backend Provider State/
    // IsDefault that applies to every org (and gates OpenRouter out of the pricing
    // catalog via the DO-first ENABLE_OPENROUTER integration).
    id: 'provider-admin',
    label: 'AI Providers',
    icon: Server,
    description: 'Enable, disable, and set the primary upstream AI provider for the shared gateway.',
    // No `gcp` analog — like the sibling customer `providers` entry above, provider
    // routing administration is Hanzo-specific with no clean single GCP product
    // equivalent (matching the sibling keeps the catalog metadata consistent).
    category: 'AI',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/ai',
    kind: 'module',
    routes: [{ path: '', component: ProviderAdminModule }],
  },
  {
    // admin.hanzo.ai PROVIDER BILLING board — the ECONOMIC lens beside the AI-Providers
    // routing board above: per-provider credit balance + burn + runway_days (has-credit vs
    // paid-only), and the credit-vs-paid-vs-BYO usage split (tokens/cost/requests) over a
    // selectable range. GLOBAL-ADMIN ONLY (`admin: true` hides it from every customer's nav/
    // palette; the catch-all renders a managed notice for a non-admin). The reads
    // `/v1/admin/providers/credit` + `/v1/admin/usage/funding` ride the SAME `getAdminGate`
    // the sibling `provider-admin` board uses (`providers`/`usage` are already allow-listed
    // admin-aggregate heads). DISTINCT from routing: this is "how much credit remains and how
    // spend is funded", not "which upstream is primary".
    id: 'provider-billing',
    label: 'Provider Billing',
    icon: Coins,
    description: 'Per-provider credit balance, burn, and runway, plus the credit-vs-paid usage split across the fleet.',
    gcp: 'Cloud Billing (provider credits)',
    category: 'AI',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: ProvidersBillingModule }],
  },
  {
    // admin.hanzo.ai GROWTH cockpit — the SuperAdmin operator view of the Zen-of-Hanzo
    // Guide engine (cloud clients/guide, /v1/guide/*): the authored blueprint (64 archetype
    // principles + the launch journey), the strategy corpus (the ~888 modern + 114 heritage
    // tactics), and the org's OWN live growth read (stage · signals · key metrics · ranked
    // next-best moves). Every blueprint item carries a live enable/disable lever (PATCH) +
    // inline edit, and "Publish version" snapshots the whole blueprint (versioned).
    // GLOBAL-ADMIN ONLY (`admin: true` hides it from every customer's nav/palette;
    // the module also gates on useIsSuperAdmin, and the /v1/guide blueprint routes are
    // SuperAdmin-gated server-side). Reads ride the `guide` head on the /v1 user-bearer BFF
    // (allow-listed in proxy-allow.ts). This is the "see and modify the guide backend" surface.
    id: 'growth',
    label: 'Growth',
    icon: Target,
    description: 'Observe and operate the Zen-of-Hanzo Guide engine — the authored blueprint, the ~888-tactic corpus, and the live growth read (stage · signals · next-best moves).',
    category: 'Observe',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: GrowthModule }],
  },
  {
    // admin.hanzo.ai AI ECONOMICS board — the STRATEGIC lens beside the Provider Billing
    // (treasury) + Finance (P&L) boards: the per-(provider,model) REQUEST MIX (how many
    // of each model), unit economics (upstream cost vs revenue vs gross margin + runway),
    // the HONEST training-data collection card (the metering ledger holds NO prompt/
    // completion content and nothing harvests traffic — the only training data is the
    // user-curated eval dataset registry), recent eval runs, and how that eval signal
    // folds into the enso router (offline ridge profile + online per-user LinUCB).
    // GLOBAL-ADMIN ONLY (`admin: true` hides it from every customer's nav/
    // palette). COMPOSES the existing admin reads — model mix from `/v1/admin/usage/
    // funding`, margin from `/v1/admin/finance`, credit from `/v1/admin/providers/credit`,
    // evals from `/v1/evals/*` — it forks none of them.
    id: 'ai-economics',
    label: 'AI Economics',
    icon: LineChart,
    description: 'Model request mix, unit economics (margin + runway), and the eval → training flywheel across the fleet.',
    gcp: 'Vertex AI (usage & cost)',
    category: 'AI',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: AiEconomicsModule }],
  },
  {
    // admin.hanzo.ai ROUTING board — the config-as-Base auto-routing editor: the
    // platform-wide default (the reserved "*" OrgSettings row) + per-org overrides,
    // each a three-state control (inherit / enabled / disabled) written as DATA to the
    // Base/SQLite OrgSettings row via `/v1/{get,update,delete}-org-settings` (all
    // RequireSuperAdmin upstream). This is where auto-routing (enso) becomes a real
    // admin toggle — set one org to Enabled for the org-first rollout, then flip the
    // global default. GLOBAL-ADMIN ONLY (`admin: true` hides it from every customer;
    // the endpoints are super-admin gated server-side, so a non-admin sees the honest
    // SuperAdminRequired panel). Runtime policy lives as editable rows, never env.
    id: 'routing',
    label: 'Routing',
    icon: Route,
    description: 'Set the platform auto-routing default and per-org overrides as data — the config-as-Base settings editor.',
    gcp: 'Vertex AI (model routing)',
    category: 'AI',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/ai',
    kind: 'module',
    routes: [{ path: '', component: RoutingModule }],
  },
  {
    // Customer surface — each org connects its OWN OpenAI / Anthropic / Google account
    // (paste an API key, or OAuth sign-in) so Hanzo serves those models on the org's
    // account AND imports the org's third-party spend into the unified Usage board. Thin
    // UI over the EXISTING KMS-backed AI Login Manager (`/v1/ai/connections`, ai#79/#80) —
    // keys are sealed to KMS server-side, never in the browser. Distinct from the
    // admin-only `providers` board (shared-gateway upstream config): this is per-org BYO.
    id: 'connections',
    label: 'Connections',
    icon: KeyRound,
    description: 'Connect your OpenAI, Anthropic, or Google account by API key or sign-in — sealed to Hanzo KMS.',
    gcp: 'Connected accounts',
    category: 'AI',
    status: 'enabled',
    repo: 'hanzoai/ai',
    kind: 'module',
    routes: [{ path: '', component: ConnectionsModule }],
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: Bot,
    description: 'Build, deploy, and run autonomous agents.',
    gcp: 'Agent Builder',
    category: 'AI',
    status: 'enabled',
    repo: 'hanzoai/agent',
    docs: `${DOCS}/agents`,
    kind: 'module',
    // Agents OWNS Status/Logs/Metrics — they render the agent registry's OWN runs
    // (health board, invocation activity, invocation/latency metrics from /v1/agents),
    // NOT the generic o11y/usage-ledger subpage (which is empty for agents until the
    // service emits OTel / the ledger tags spend product:agents). Same pattern as
    // Inference owning Status/Logs. Settings stays the shared subpage.
    routes: [
      { path: '', component: AgentsModule },
      { path: ':tab', component: AgentsModule },
    ],
    subpages: [
      // The guided way in: describe an agent or start from a template, configure it in
      // the ONE builder, run it, and take the call away. Leads the sub-nav because it
      // is where someone with no agents yet should land.
      { slug: 'quickstart', label: 'Quickstart' },
      { slug: 'status', label: 'Status' },
      { slug: 'logs', label: 'Logs' },
      { slug: 'metrics', label: 'Metrics' },
    ],
  },
  {
    // Mission Control — the mobile-first swipeable terminal-per-agent cockpit over the
    // live agent-session plane (cloud clients/agents, /v1/agents/sessions): see + drive
    // every session (CLI on a laptop, bot in cloud, linked GPU box) + the run-target seam.
    id: 'mission-control',
    label: 'Mission Control',
    icon: Terminal,
    description: 'See and drive every agent session from one swipeable board — pause, resume, stop, message.',
    category: 'AI',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: MissionControlModule }],
  },
  {
    // Hanzo Automations — the ONE native Connectors + Automations engine
    // (hanzoai/cloud clients/automations, /v1/automations; HIP-0106 / task #51):
    // an org's flows run durably on the shared hanzoai/tasks engine over the
    // go:embed'd 706-connector catalogue, credentials KMS-sealed per org. Rendered
    // NATIVELY in-console (flows + connector catalogue + runs) over the /v1
    // user-bearer proxy — NO link-out, ONE surface. The retired standalone
    // auto.hanzo.ai engine + its /v1/auto reverse proxy are gone; `/auto` and
    // `/automation` alias here (match-core). hanzo-scoped so it never appears on a
    // Lux/Zoo console.
    id: 'automations',
    label: 'Automations',
    icon: Workflow,
    description: 'Build and run automation flows — 706 connectors on the native /v1/automations engine.',
    gcp: 'Application Integration',
    category: 'AI',
    status: 'enabled',
    brands: ['hanzo'],
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [
      { path: '', component: AutomationsModule },
      { path: ':tab', component: AutomationsModule },
    ],
    indexLabel: 'Flows',
    subpages: [
      { slug: 'connectors', label: 'Connectors' },
      { slug: 'runs', label: 'Runs' },
    ],
  },
  {
    id: 'inference',
    label: 'Inference',
    icon: Zap,
    description: 'Online and batch inference for deployed models.',
    gcp: 'Vertex AI Prediction',
    category: 'AI',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    // Inference OWNS its Status + Logs as rich, endpoint-oriented views (the `:tab`
    // route) — declaring them as SPECIFIC sub-pages makes the router render THESE
    // instead of the generic shared sub-page for those slugs. Metrics + Settings stay
    // on the shared per-product system (Metrics = the rich per-product LivingOverview).
    routes: [
      { path: '', component: InferenceModule },
      { path: ':tab', component: InferenceModule },
    ],
    subpages: [
      { slug: 'status', label: 'Status' },
      { slug: 'logs', label: 'Logs' },
    ],
  },
  {
    id: 'finetuning',
    label: 'Fine-tuning',
    icon: Sparkles,
    description: 'Fine-tune and train models on your own data.',
    gcp: 'Vertex AI Training',
    category: 'Training',
    status: 'enabled',
    kind: 'module',
    // The module renders its Jobs/Datasets/Checkpoints/Models tabs as REAL
    // sub-routes (`/finetuning/:tab`); declare the `:tab` route so the tab bar
    // resolves instead of 404ing.
    routes: [
      { path: '', component: FinetuningModule },
      { path: ':tab', component: FinetuningModule },
    ],
    indexLabel: 'Jobs',
    subpages: [
      { slug: 'interactive', label: 'Interactive' },
      { slug: 'datasets', label: 'Datasets' },
      { slug: 'checkpoints', label: 'Checkpoints' },
      { slug: 'models', label: 'Models' },
      { slug: 'configs', label: 'Configs' },
    ],
  },
  {
    // The embeddings product — generate, store, and search vector embeddings.
    // Collections ARE the per-org knowledge stores (get-stores), each mapping to
    // the Qdrant/Search index {owner}-{store}-docs; Models/generate use the
    // gateway (/v1/models, /v1/embeddings); Explore is /v1/search. The old
    // Stores admin (StoresModule) is SUPERSEDED by this — one surface, not two.
    id: 'embeddings',
    label: 'Embeddings',
    icon: Boxes,
    description: 'Generate, store, and search vector embeddings at scale.',
    gcp: 'Vertex AI Vector Search',
    category: 'AI',
    status: 'enabled',
    repo: 'hanzoai/ai',
    docs: `${DOCS}/embeddings`,
    kind: 'module',
    routes: [
      { path: '', component: EmbeddingsModule },
      { path: ':tab', component: EmbeddingsModule },
      { path: 'collections/:name', component: EmbeddingsModule },
    ],
    subpages: [
      { slug: 'explore', label: 'Explore', icon: Search },
      { slug: 'collections', label: 'Collections', icon: Boxes },
      { slug: 'ingest', label: 'Ingest', icon: Upload },
      { slug: 'models', label: 'Models', icon: Brain },
      { slug: 'settings', label: 'Settings', icon: SlidersHorizontal },
    ],
  },
  {
    // Knowledge — the org's KB knowledge graph (cloud clients/knowledge). Pages,
    // agent memories, and ingested sources as a force-directed graph over
    // /v1/kb/graph, plus a vault importer (Obsidian/Notion/Roam/Evernote) over
    // /v1/kb/import. Org-scoped SERVER-SIDE via the /v1 bearer proxy.
    id: 'knowledge',
    label: 'Knowledge',
    icon: Network,
    description: 'Your wiki, agent memory, and sources as one force-directed graph.',
    category: 'AI',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: KnowledgeModule }],
  },
  {
    // Native console evals — REAL run (POST /v1/evals/runs) + scores
    // (GET /v1/evals/scores) over the cloud evals facade. Grouped under Observe
    // per the taxonomy; the entry stays in array position (no reorder).
    id: 'evals',
    label: 'Evals',
    icon: ListChecks,
    description: 'Evaluate model and agent outputs with scored runs.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    kind: 'module',
    routes: [
      { path: '', component: EvalsModule },
      { path: ':tab', component: EvalsModule },
    ],
    indexLabel: 'Run',
    subpages: [{ slug: 'scores', label: 'Scores' }],
  },

  // ── Compute ──────────────────────────────────────────────────────────
  {
    // The "see everything running" view — the org's whole deployment landscape
    // (apps + managed data + domains) as a live, pannable node canvas. Composed
    // from the SAME real reads the lists use (PaasApi /v1/platform + Provisioning
    // /v1/<kind>); leads Compute because it is the primary at-a-glance surface,
    // not a buried subpage. Honest edges only (domain→app routes; app→resource
    // where an env value exposes the link) — see components/products/map/graph.ts.
    id: 'map',
    label: 'Map',
    icon: Network,
    description: 'Every app, database, and domain in your org on one live canvas.',
    category: 'Compute',
    status: 'enabled',
    repo: 'hanzoai/console',
    docs: `${DOCS}/console`,
    kind: 'module',
    routes: [{ path: '', component: MapModule }],
  },
  {
    id: 'gpus',
    label: 'GPUs',
    icon: Cpu,
    description: 'GPU clusters, utilization, and cost — on-demand H100/A100 compute.',
    gcp: 'Compute Engine GPUs',
    category: 'Compute',
    status: 'enabled',
    repo: 'hanzoai/operator',
    docs: `${DOCS}/gpus`,
    kind: 'module',
    // Overview ('') is role-aware (GpusOverview: admin → LivingOverview of the real
    // operator inventory + health; customer → the visor GPU catalog + their machines);
    // the product tabs stay on GpusModule via `:tab` (also role-routed), reachable from
    // the sidebar's level-2 sub-nav (declared below) so the overview is never a dead-end.
    routes: [
      { path: '', component: GpusOverview },
      { path: ':tab', component: GpusModule },
    ],
    subpages: [
      { slug: 'gpus', label: 'GPUs' },
      { slug: 'queue', label: 'Queue' },
      { slug: 'clusters', label: 'Clusters' },
      { slug: 'pools', label: 'Pools' },
      { slug: 'pricing', label: 'Pricing' },
      { slug: 'alerts', label: 'Alerts' },
    ],
  },
  {
    id: 'machines',
    label: 'Machines',
    icon: Server,
    description: 'Compute machines and capacity across regions (your cluster nodes).',
    category: 'Compute',
    status: 'enabled',
    docs: `${DOCS}/machines`,
    kind: 'module',
    routes: [{ path: '', component: MachinesModule }],
  },
  {
    id: 'containers',
    label: 'Containers',
    icon: Container,
    description: 'Run containers as managed, autoscaling services.',
    gcp: 'Cloud Run',
    category: 'Compute',
    status: 'enabled',
    kind: 'module',
    // The module renders its Workloads/Pods/Containers/Images/Namespaces/Events
    // tabs as REAL sub-routes (`/containers/:tab`); declare the `:tab` route so the
    // tab bar resolves instead of 404ing.
    routes: [
      { path: '', component: ContainersModule },
      { path: ':tab', component: ContainersModule },
    ],
    indexLabel: 'Workloads',
    subpages: [
      { slug: 'pods', label: 'Pods' },
      { slug: 'containers', label: 'Containers' },
      { slug: 'images', label: 'Images' },
      { slug: 'namespaces', label: 'Namespaces' },
      { slug: 'events', label: 'Events' },
    ],
  },
  {
    id: 'functions',
    label: 'Functions',
    icon: FunctionSquare,
    description: 'Event-driven serverless functions.',
    category: 'Compute',
    status: 'enabled',
    repo: 'hanzoai/functions',
    docs: `${DOCS}/functions`,
    kind: 'module',
    // ONE component owns the product at every level, so the index carries the same
    // level-2 nav its tabs do; the index BOARD is still the reusable LivingOverview
    // (real inventory + metrics), rendered by the module.
    routes: [
      { path: '', component: FunctionsModule },
      { path: ':tab', component: FunctionsModule },
    ],
    subpages: [
      { slug: 'functions', label: 'Functions' },
      { slug: 'deployments', label: 'Deployments' },
      { slug: 'triggers', label: 'Triggers' },
      { slug: 'secrets', label: 'Secrets' },
    ],
  },
  {
    id: 'edge',
    label: 'Edge',
    icon: Radio,
    description: 'Compute at the edge, close to your users.',
    category: 'Compute',
    status: 'enabled',
    repo: 'hanzoai/edge',
    docs: `${DOCS}/edge`,
    kind: 'module',
    routes: [{ path: '', component: EdgeModule }],
  },
  {
    // Real, enabled deploy surface — kept under Compute as the running-app
    // primitive (deployed application services). The Cloud-Run-style "Containers"
    // product is a separate enabled entry (above) over the same PaaS backend.
    id: 'applications',
    label: 'Applications',
    icon: Box,
    description: 'Deployed application services.',
    category: 'Compute',
    status: 'enabled',
    kind: 'module',
    routes: [
      { path: '', component: ApplicationsModule },
      { path: ':name', component: ApplicationsModule },
    ],
  },
  {
    // The USER-facing per-org PaaS over cloud's native /v1/platform control plane
    // (hanzoai/cloud clients/platform): your own container apps — deploy, source-
    // tagged logs, KMS-sealed env (secret-masked), and verified custom domains.
    // Org-scoped by the Bearer owner via the /v1 bearer BFF. DISTINCT from the admin
    // `applications` fleet board (/v1/apps) and internal-admin platform.hanzo.ai.
    id: 'app-platform',
    label: 'App Platform',
    icon: Rocket,
    description: 'Deploy and manage your container apps — projects, deploys, logs, secrets, domains.',
    gcp: 'App Engine',
    category: 'Compute',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: PlatformAppsModule }],
  },

  // ── Data — Hanzo Cloud as an open Google Cloud. Each is a ZAP-native Hanzo
  //    fork (NOT vanilla OSS), provisioned through the shared `resourceModule`
  //    factory over the provisioning contract (POST/GET/DELETE /v1/<kind>).
  {
    id: 'vector',
    label: 'Vector',
    icon: Boxes,
    description: 'Managed vector database — embeddings & semantic search.',
    category: 'Data',
    status: 'enabled',
    repo: 'hanzoai/vector',
    docs: `${DOCS}/vector`,
    kind: 'module',
    routes: resourceRoutes({ kind: 'vector', productLabel: 'Hanzo Vector', connectionHint: 'Point a Vector client at host:port using the connection string.' }),
  },
  {
    id: 'sql',
    label: 'SQL',
    icon: Database,
    description: 'Managed SQL — databases, branches, replicas.',
    category: 'Data',
    status: 'enabled',
    repo: 'hanzoai/sql',
    docs: `${DOCS}/sql`,
    kind: 'module',
    routes: resourceRoutes({ kind: 'sql', productLabel: 'Hanzo SQL', connectionHint: 'Connect any SQL client with the connection string.' }),
  },
  {
    id: 'kv',
    label: 'KV',
    icon: Key,
    description: 'Managed key-value store — cache & queues.',
    gcp: 'Memorystore',
    category: 'Data',
    status: 'enabled',
    repo: 'hanzoai/kv',
    docs: `${DOCS}/kv`,
    kind: 'module',
    routes: resourceRoutes({ kind: 'kv', productLabel: 'Hanzo KV', connectionHint: 'Connect with any KV client using the connection string.' }),
  },
  {
    // A REAL S3 file manager (buckets + objects, folder navigation, upload/
    // download/delete) over the org-scoped `/v1/s3` control plane in the unified
    // cloud binary — NOT the generic provisioning resource card. It complements
    // the provisioning surface (which allocates the s3 RESOURCE): a bucket
    // created here or there is browsable here, same org namespace.
    id: 's3',
    label: 'S3',
    icon: HardDrive,
    description: 'Managed S3-compatible object storage — buckets and objects, scoped to your org.',
    gcp: 'Cloud Storage',
    category: 'Data',
    status: 'enabled',
    repo: 'hanzoai/s3',
    docs: `${DOCS}/storage`,
    kind: 'module',
    routes: [{ path: '', component: StorageModule }],
  },
  {
    id: 'datastore',
    label: 'Datastore',
    icon: Server,
    description: 'Managed wide-column analytics store.',
    gcp: 'Bigtable',
    category: 'Data',
    status: 'enabled',
    repo: 'hanzoai/datastore',
    docs: `${DOCS}/datastore`,
    kind: 'module',
    routes: resourceRoutes({ kind: 'datastore', productLabel: 'Hanzo Datastore', connectionHint: 'Connect over the Datastore HTTP/native protocol using the connection string.' }),
  },
  {
    // Manage the org's Hanzo Base instances ("Bases"). Each Base is a row in the
    // SuperBase orchestrator's `tenants` collection — its own realtime backend on
    // `<slug>.base.hanzo.ai`. All calls go through console2's `/superbase/*` proxy
    // (per-user IAM bearer minted server-side, org stamped from the JWT owner).
    id: 'base',
    label: 'Base',
    icon: Boxes,
    description: 'Realtime backends for your org — spin up a Base with content types, records, and auth.',
    category: 'Data',
    status: 'enabled',
    repo: 'hanzoai/base',
    docs: `${DOCS}/base`,
    kind: 'module',
    // Bases manager: `''` lists your Bases, `new` creates one, `:base` configures
    // one (`:base` = its record id). `new` precedes `:base` so `/base/new` is the
    // create flow, not a Base whose id is "new" (that slug is reserved). A Base's
    // own data — collections + records — is the sibling `Records` product.
    routes: [
      { path: '', component: BaseModule },
      { path: 'new', component: BaseModule },
      { path: ':base', component: BaseModule },
    ],
  },
  {
    // Records — browse + edit any Base collection's data BY CLICKING (the CRM/CMS
    // surface). Renders each collection's rows/detail from its own field schema
    // through @hanzo/data (DataTable + RecordDetail/RecordForm) over the same
    // per-user /superbase proxy. Base is the backend; this is the app on top.
    id: 'records',
    label: 'Records',
    icon: Boxes,
    description: 'Browse and edit any Base collection as a CRM/CMS — from its own schema.',
    category: 'Data',
    status: 'enabled',
    repo: 'hanzoai/base',
    docs: `${DOCS}/base`,
    kind: 'module',
    routes: [
      { path: '', component: RecordsModule },
      { path: ':collection', component: RecordsModule },
      { path: ':collection/:id', component: RecordsModule },
    ],
  },
  {
    id: 'docdb',
    label: 'DocDB',
    icon: FileText,
    description: 'Managed document database.',
    gcp: 'Firestore',
    category: 'Data',
    status: 'enabled',
    repo: 'hanzoai/docdb',
    docs: `${DOCS}/docdb`,
    kind: 'module',
    routes: resourceRoutes({ kind: 'docdb', productLabel: 'Hanzo DocDB', connectionHint: 'Connect with any DocDB driver using the connection string.' }),
  },

  // ── Network ──────────────────────────────────────────────────────────
  {
    id: 'gateway',
    label: 'Gateway',
    icon: Network,
    description: 'The unified, gated, priced API gateway — api.hanzo.ai.',
    gcp: 'API Gateway',
    category: 'Network',
    status: 'enabled',
    repo: 'hanzoai/gateway',
    docs: `${DOCS}/gateway`,
    kind: 'module',
    routes: overviewRoutes('gateway'),
  },
  {
    // Per-node blockchain infrastructure — validators (P-chain) + peers (info
    // API) across the REAL luxd primary networks. In `Network`, so it surfaces on
    // hanzo (all-networks super-admin/infra view) AND lux/zoo/pars (each scoped to
    // its own chain — see `nodeNetworksForBrand`). Reads live luxd RPC via the
    // /nodes proxy; honest "not reporting" per unreachable network.
    id: 'nodes',
    label: 'Nodes',
    icon: Server,
    description: 'Blockchain node infrastructure — validators and peers across networks.',
    category: 'Network',
    status: 'enabled',
    repo: 'luxfi/node',
    kind: 'module',
    routes: [{ path: '', component: NodesModule }],
  },
  {
    id: 'vpc',
    label: 'VPC',
    icon: Waypoints,
    description: 'Private networks, subnets, and peering.',
    category: 'Network',
    status: 'enabled',
    kind: 'module',
    routes: [{ path: '', component: VpcModule }],
  },
  {
    id: 'dns',
    label: 'DNS',
    icon: Globe,
    description: 'Managed authoritative DNS.',
    gcp: 'Cloud DNS',
    category: 'Network',
    status: 'enabled',
    repo: 'hanzoai/dns',
    docs: ext.dns,
    kind: 'module',
    // Real per-org managed DNS via hanzodns (zones + records → CoreDNS + Cloudflare
    // sync) on the unified /v1/dns surface; honest states until the route is bound.
    routes: [{ path: '', component: DnsModule }],
  },
  {
    // Domains — REGISTER names (distinct from DNS, which manages records). Backed by
    // the Hanzo Domains control plane (cloud clients/domain → name.com reseller):
    // search/price/buy over /v1/domain, billed to the org's prepaid balance, the
    // domain born on Hanzo nameservers with its zone handed to hanzoai/dns.
    id: 'domains',
    label: 'Domains',
    icon: Tag,
    description: 'Search, register, and renew domain names.',
    gcp: 'Cloud Domains',
    category: 'Network',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: DomainsModule }],
  },
  {
    // Cloudflare — the org's OWN connected Cloudflare account, managed in-console
    // over the asset plane at /v1/integrations/cloudflare/* (cloud clients/cloudflare).
    // Sits beside DNS because it drives the SAME per-org KMS-sealed token hanzodns
    // uses for Cloudflare-synced zones. Pages + Workers are wired; R2/KV/D1 are
    // honest Phase-2 tabs. Connecting the account is the generic integrations flow.
    id: 'cloudflare',
    label: 'Cloudflare',
    icon: Cloud,
    description: 'Manage your connected Cloudflare Pages, Workers, and routes.',
    category: 'Network',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: CloudflareModule }],
  },
  {
    id: 'cdn',
    label: 'CDN',
    icon: Cable,
    description: 'Global content delivery and edge caching.',
    category: 'Network',
    status: 'enabled',
    docs: ext.cdn,
    kind: 'module',
    routes: overviewRoutes('cdn'),
  },
  {
    id: 'load-balancer',
    label: 'Load Balancer',
    icon: Spline,
    description: 'Layer 4/7 load balancing across services.',
    category: 'Network',
    status: 'enabled',
    kind: 'module',
    routes: [{ path: '', component: LoadBalancerModule }],
  },
  {
    id: 'service-mesh',
    label: 'Service Mesh',
    icon: Waypoints,
    description: 'Service-to-service routing, mTLS, and policy.',
    category: 'Network',
    status: 'enabled',
    kind: 'module',
    routes: [{ path: '', component: ServiceMeshModule }],
  },

  // ── Security ─────────────────────────────────────────────────────────
  {
    id: 'iam',
    label: 'IAM',
    icon: Shield,
    description: 'Organizations, users, and roles (RBAC) — Hanzo IAM.',
    category: 'Security',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/iam',
    docs: `${DOCS}/iam`,
    kind: 'module',
    routes: [
      { path: '', component: IamModule },
      { path: ':tab', component: IamModule },
    ],
    subpages: [
      { slug: 'users', label: 'Users' },
      { slug: 'roles', label: 'Roles' },
    ],
  },
  {
    id: 'authz',
    label: 'Authz',
    icon: ShieldCheck,
    description: 'Fine-grained authorization policies and checks.',
    category: 'Security',
    status: 'enabled',
    repo: 'hanzoai/authz',
    docs: `${DOCS}/authz`,
    kind: 'module',
    routes: [{ path: '', component: AuthzModule }],
  },
  {
    id: 'kms',
    label: 'KMS',
    icon: KeyRound,
    description: 'Encryption keys and cryptographic operations — Hanzo KMS.',
    category: 'Security',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/kms',
    docs: `${DOCS}/kms`,
    kind: 'module',
    routes: [{ path: '', component: KmsModule }],
  },
  {
    id: 'hsm',
    label: 'HSM',
    icon: Fingerprint,
    description: 'Hardware-backed key protection.',
    category: 'Security',
    status: 'enabled',
    repo: 'hanzoai/hsm',
    kind: 'module',
    routes: [{ path: '', component: HsmModule }],
  },
  {
    // Secret Manager facet of the same zero-knowledge KMS backend.
    id: 'secrets',
    label: 'Secrets',
    icon: Lock,
    description: 'Store and rotate secrets — zero-knowledge, on Hanzo KMS.',
    gcp: 'Secret Manager',
    category: 'Security',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/kms',
    docs: `${DOCS}/kms`,
    kind: 'module',
    routes: [{ path: '', component: KmsModule }],
  },
  {
    id: 'mpc',
    label: 'MPC',
    icon: Network,
    description: 'Threshold signing & multi-party computation — Hanzo MPC.',
    category: 'Security',
    status: 'enabled',
    repo: 'hanzoai/mpc',
    docs: `${DOCS}/mpc`,
    kind: 'module',
    routes: overviewRoutes('mpc'),
  },
  {
    id: 'audit',
    label: 'Audit',
    icon: ScrollText,
    description: 'Audit log of identity and access events.',
    category: 'Security',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/iam',
    kind: 'module',
    routes: [{ path: '', component: AuditModule }],
  },
  {
    id: 'zero-trust',
    label: 'Zero Trust',
    icon: ShieldCheck,
    description: 'Private service access: routers, identities, policies, and sessions.',
    category: 'Security',
    status: 'enabled',
    repo: 'hanzoai/zt',
    docs: `${DOCS}/zero-trust`,
    kind: 'module',
    routes: [
      { path: '', component: ZeroTrustModule },
      { path: ':tab', component: ZeroTrustModule },
    ],
    subpages: [
      { slug: 'services', label: 'Services' },
      { slug: 'identities', label: 'Identities' },
      { slug: 'routers', label: 'Routers' },
      { slug: 'policies', label: 'Policies' },
      { slug: 'sessions', label: 'Sessions' },
    ],
  },

  // ── Dev ──────────────────────────────────────────────────────────────
  {
    id: 'cli',
    label: 'CLI',
    icon: Terminal,
    description: 'The hanzo command-line interface.',
    category: 'Dev',
    status: 'enabled',
    repo: 'hanzoai/cli',
    docs: ext.cli,
    kind: 'module',
    routes: overviewRoutes('cli'),
  },
  {
    id: 'sdks',
    label: 'SDKs',
    icon: Package,
    description: 'Python, TypeScript, Go, and Rust SDKs.',
    category: 'Dev',
    status: 'enabled',
    docs: ext.sdk,
    kind: 'module',
    routes: overviewRoutes('sdks'),
  },
  {
    id: 'api',
    label: 'API',
    icon: Code2,
    description: 'The REST API reference for every service.',
    category: 'Dev',
    status: 'enabled',
    repo: 'hanzoai/ai',
    docs: ext.api,
    kind: 'module',
    routes: overviewRoutes('api'),
  },
  {
    // Webhooks — the org's outbound event destinations over the real cloud
    // /v1/webhooks surface (config · enable/disable · rotate secret · test-send ·
    // delivery logs). A full CRUD module like VPC/LoadBalancer; the newer
    // sub-features (test/deliveries/rotate) degrade gracefully if not yet routed.
    // The `:view` route is the deliveries deep-link (auto-expands that endpoint).
    id: 'webhooks',
    label: 'Webhooks',
    icon: Webhook,
    description: 'Deliver platform events to your endpoints — signed, retried, logged.',
    category: 'Dev',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [
      { path: '', component: WebhooksModule },
      { path: ':view', component: WebhooksModule },
    ],
  },
  {
    // The customer-facing "connect your tools" page. A logged-in org connects
    // Slack / GitHub (and any provider the cloud connector framework registers) via
    // a Connect button that runs the ORG-AUTHED OAuth flow through the canonical /v1
    // client — the slug stays `/integrations` because it is the backend callback's
    // redirect target (?connected=<id> / ?error=<id>). Single route (no `:tab`): the
    // old read-only DataTable surface is superseded by this Connect grid.
    id: 'integrations',
    label: 'Integrations',
    icon: Cable,
    description: 'Connect Slack, GitHub, and more so Hanzo AI can work across your tools.',
    category: 'Settings',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    docs: `${DOCS}/integrations`,
    kind: 'module',
    routes: [{ path: '', component: OrgIntegrationsModule }],
  },
  {
    // Native console playground — REAL model run over the OpenAI-compatible
    // gateway (GET /v1/models + POST /v1/chat/completions). Grouped under AI per
    // the taxonomy; the entry stays in array position (no reorder).
    id: 'playground',
    label: 'Playground',
    icon: Play,
    description: 'Try models and prompts interactively.',
    category: 'AI',
    status: 'enabled',
    repo: 'hanzoai/ai',
    kind: 'module',
    routes: [{ path: '', component: PlaygroundModule }],
  },
  {
    // Code — the unified Code hub (Dev): ALL our code in ONE place. Folds the former Git
    // (the org's hosted repos over /v1/git) and Code (the code-intelligence engine over
    // /v1/code, HIP-0302 — hybrid lexical+symbolic+semantic retrieval) into ONE product:
    //   ''            → the hub, default tab Repositories
    //   :tab          → Repositories · Search · Ask
    //   repos/:name   → the repo browser (tree · blob · commits, agentically editable)
    // Org-scoped SERVER-SIDE (no org param leaves the browser), so it is brand-agnostic —
    // every brand's console shows ITS OWN org's repos, no cross-brand leak. git.hanzo.ai
    // stays the `git clone`/`git push` smart-HTTP host; THIS is the dashboard it links to.
    id: 'code',
    label: 'Code',
    icon: Code2,
    description: 'Browse every repo, search across your code, and get cited answers — the unified hub over native git.',
    gcp: 'Cloud Source Repositories',
    category: 'Dev',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    subpages: [
      { slug: 'repos', label: 'Repositories', icon: FolderGit2 },
      { slug: 'search', label: 'Search', icon: Search },
      { slug: 'ask', label: 'Ask', icon: Sparkles },
    ],
    routes: [
      { path: '', component: CodeModule },
      { path: ':tab', component: CodeModule },
      { path: 'repos/:name', component: CodeModule },
    ],
  },
  {
    id: 'ide',
    label: 'IDE',
    icon: Code,
    description: 'The Hanzo AI development environment.',
    category: 'Dev',
    status: 'enabled',
    repo: 'hanzoai/code',
    docs: ext.ide,
    kind: 'module',
    routes: overviewRoutes('ide'),
  },
  {
    id: 'desktop',
    label: 'Desktop',
    icon: Monitor,
    description: 'The Hanzo desktop app.',
    category: 'Dev',
    status: 'enabled',
    repo: 'hanzoai/desktop',
    docs: ext.desktop,
    kind: 'module',
    routes: overviewRoutes('desktop'),
  },

  // ── Deploy — the PaaS control plane (platform.hanzo.ai) over the /paas
  //    proxy. Clusters and Kubernetes are the real, wired surfaces; the rest of
  //    the CI/CD pipeline ships incrementally.
  {
    // The project HUB: create an IAM-native project → deploy a static build (drag-drop
    // zip/tar.gz → /v1/platform/sites) → manage deployments, domains, config → and
    // deep-link the SAME project to hanzo.app (edit) + hanzo.chat (chat) on one shared
    // key. The Platform-category flagship; `projects` stays the thin scope picker.
    id: 'platform',
    label: 'Platform',
    icon: Layers,
    description: 'Create, deploy, and ship your projects — drop a build, bind a domain, and edit or chat about the same project across hanzo.app and hanzo.chat.',
    gcp: 'App Hosting',
    category: 'Platform',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [
      { path: '', component: PlatformModule },
      { path: ':name', component: PlatformModule },
    ],
  },
  {
    // App Store — the OSS one-click marketplace: browse the LIVE 1000+-app catalog
    // (templates.hanzo.ai/meta.json, open CORS → fetched straight from the browser, no
    // BFF) and deploy any of them over the console's REAL PaaS path (`PaasApi` →
    // `/v1/platform/*`). The maker payout hook routes to the in-console OSS Author
    // program. The centerpiece of the platform.<brand> deploy experience.
    id: 'store',
    label: 'App Store',
    icon: Boxes,
    description: 'Deploy 1000+ open-source apps — Postgres, n8n, Grafana, and more — to your cloud in one click.',
    gcp: 'Cloud Marketplace',
    category: 'Platform',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [
      { path: '', component: StoreModule },
      // The per-app detail page: what a deploy actually provisions, read from the
      // blueprint itself, so the decision to run someone else's stack is informed.
      { path: ':id', component: StoreDetail },
    ],
  },
  {
    // Deploy — the front door for shipping. ONE section over the two things an org
    // deploys (container apps via `/v1/platform/projects/:p/apps`, static sites via
    // `/v1/platform/sites`) plus readings of the three planes a deploy touches:
    // CD (`/v1/deploy/applications` — reconciliation of the caller's own App CRs),
    // CI (`/v1/builds`), and Storage (`/v1/s3/buckets`). Each is the ONE canonical
    // head for its subject; there is deliberately no `/v1/platform/cd|ci|s3` alias,
    // which would give the estate two paths to the same data.
    //
    // It COMPOSES the existing typed clients rather than re-implementing them, and
    // deep-links to the product that owns each subject for anything deeper — so App
    // Platform stays the place to operate one app, and S3 to browse objects.
    // NOT admin-gated: shipping your own code is the customer's own business, and
    // every read is org-scoped server-side from the bearer proxy's token owner.
    id: 'deploy',
    label: 'Deploy',
    icon: Rocket,
    description:
      'Ship an app or a static site — pick a repo, bind a host, set env, deploy. Then watch CD reconcile it, CI build it, and storage serve it.',
    gcp: 'Cloud Deploy',
    category: 'Platform',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [
      { path: '', component: DeployModule },
      { path: ':tab', component: DeployModule },
    ],
    subpages: [
      { slug: 'apps', label: 'Apps', icon: AppWindow },
      { slug: 'sites', label: 'Sites', icon: Globe },
      { slug: 'domains', label: 'Domains', icon: Cable },
      { slug: 'cd', label: 'CD', icon: GitBranch },
      { slug: 'ci', label: 'CI', icon: Hammer },
      { slug: 'storage', label: 'Storage', icon: HardDrive },
    ],
  },
  {
    // The native ArgoCD replacement, rendered as a Railway-grade fleet MAP
    // (the surface cd.hanzo.ai serves). A PLATFORM surface (admin: true → hidden from
    // every customer's nav/palette today; the org-scoped projection opens it
    // per-org) that reads the live operator App CRs through cloud's /v1/deploy/* — the
    // console holds NO cluster credentials; cloud holds the k8s client and enforces
    // authz server-side. Every CR is a live node: its declared image, folded health +
    // sync, owned-resource topology, CI builds, logs, and confirm-gated Sync/Rollback
    // (rollback pins the CR image tag to a prior clean-semver release → the operator
    // reconciles). The map/drawer are the shared @hanzo/canvas primitive.
    // Labelled `Fleet`, not `Deploy`: this is the ESTATE map (every org's App CRs,
    // admin-only), while `deploy` above is the customer's own front door. Two
    // entries labelled "Deploy" would have sat side by side in a SuperAdmin's
    // Platform section, one of them showing somebody else's workloads.
    id: 'gitops',
    label: 'Fleet',
    icon: GitBranch,
    description: 'The fleet deploy map — every operator App CR as a live node with reconciled health, sync, resource topology, CI builds, logs, and one-click rollback. The Hanzo operator reconciles.',
    gcp: 'Cloud Deploy',
    category: 'Platform',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [
      { path: '', component: GitOpsModule },
      { path: ':name', component: GitOpsModule },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderGit2,
    description: 'Projects organize resources under your org — the scope for o11y, API keys, datasets, and deploys.',
    gcp: 'Resource Manager',
    category: 'Platform',
    status: 'enabled',
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: ProjectsModule }],
  },
  {
    // Native, Linear-grade @hanzo/gui issue tracker over the real cloud `/v1/tracker`
    // surface (cloud clients/tracker — native Go, per-(org,team) SQLite). The durable
    // replacement for the retired Huly/Svelte hanzo.team tracker: a unified board across
    // every team AND every mirrored GitHub repo (the App-webhook seam), a grouped List +
    // Board + Cycles + Roadmap, a keyboard-first command palette, and agent-actionable
    // work (assign → the coding seam opens a linked PR). tracker.hanzo.ai wears this as a
    // standalone shell (see lib/products/shell.ts); here it is one product among many.
    // The `:view` route serves My Issues / Teams / Cycles / Roadmap; `:view/:sub` a team
    // board (teams/ENG). Issue detail is a pane, not a route.
    id: 'tracker',
    label: 'Tracker',
    icon: ClipboardList,
    description: 'Every issue across every team and GitHub repo — one board, keyboard-first, agent-actionable.',
    gcp: 'Cloud Issue Tracker',
    category: 'Platform',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [
      { path: '', component: TrackerModule },
      { path: ':view', component: TrackerModule },
      { path: ':view/:sub', component: TrackerModule },
    ],
    subpages: [
      { slug: 'my', label: 'My Issues' },
      { slug: 'teams', label: 'Teams' },
      { slug: 'cycles', label: 'Cycles' },
      { slug: 'roadmap', label: 'Roadmap' },
    ],
  },
  {
    // White-label TENANTS board — the operator surface for launching, branding,
    // domain-binding, and managing white-label tenants + resold sub-orgs. GLOBAL-ADMIN
    // ONLY (`admin: true` hides it from every customer's nav/palette). It
    // COMPOSES real backends: the IAM org list (/admin/iam, global-admin gated) is the
    // tenant set + brand; the admin cockpit (/v1/admin/customers) is plan/wallet/status;
    // the platform (/paas) provisions clusters + (follow-up) domains/packages. The '' route
    // is the tenants list + reseller tree; the `:tab` route serves the package catalog
    // (`/tenants/packages`). Reseller self-scoping + a real `parentOrgId` are the
    // foundation follow-ups (flagged honestly in the board, never fabricated).
    id: 'tenants',
    label: 'Tenants',
    icon: Building2,
    description: 'White-label tenants + resold sub-orgs — brand, domain, IAM scope, packages, and billing.',
    gcp: 'Cloud Identity (org management)',
    category: 'Platform',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [
      { path: '', component: TenantsModule },
      { path: ':tab', component: TenantsModule },
    ],
    subpages: [{ slug: 'packages', label: 'Packages', icon: Boxes }],
  },
  {
    // Apps — the org's BUILDABLE SITES (cloud clients/projectsvc, /v1/projects): the
    // projects hanzo.app publishes when a user ships a site from the conversational
    // builder. Closes the console→app round-trip — every published site lists here
    // with its live URL + deploy history, and each row deep-links back into hanzo.app
    // (`/dev?project=<slug>`) for more editing. DISTINCT from the IAM `projects` entry
    // above (the org's resource SCOPE for o11y/keys/datasets) and from Compute
    // `Applications` (PaaS container apps) — this is the hanzo.app sites store only.
    id: 'apps',
    label: 'Apps',
    icon: AppWindow,
    description: 'The sites you build and publish in hanzo.app — live URL, deploy history, and one-click editing.',
    gcp: 'Firebase Hosting',
    category: 'Platform',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    docs: `${DOCS}/apps`,
    kind: 'module',
    // Overview ('') lists the org's sites; the `:slug` route opens a site's detail
    // rail (real deployment history) — the same routed-detail shape Chat uses.
    routes: [
      { path: '', component: AppsModule },
      { path: ':slug', component: AppsModule },
    ],
  },
  {
    id: 'environments',
    label: 'Environments',
    icon: Layers,
    description: 'Promote builds across dev, staging, and prod.',
    category: 'Platform',
    status: 'enabled',
    kind: 'module',
    routes: [{ path: '', component: EnvironmentsModule }],
  },
  {
    id: 'builds',
    label: 'Builds',
    icon: Hammer,
    description: 'Build images and artifacts from source.',
    category: 'Platform',
    status: 'enabled',
    kind: 'module',
    routes: [{ path: '', component: BuildsModule }],
  },
  {
    id: 'registry',
    label: 'Registry',
    icon: Package,
    description: 'Container images and artifacts — ghcr.io/hanzoai.',
    gcp: 'Artifact Registry',
    category: 'Platform',
    status: 'enabled',
    repo: 'hanzoai/registry',
    docs: `${DOCS}/registry`,
    kind: 'module',
    routes: overviewRoutes('registry'),
  },
  {
    id: 'releases',
    label: 'Releases',
    icon: Rocket,
    description: 'Versioned releases and rollbacks.',
    category: 'Platform',
    status: 'enabled',
    kind: 'module',
    routes: [{ path: '', component: ReleasesModule }],
  },
  {
    id: 'pipelines',
    label: 'Pipelines',
    icon: GitBranch,
    description: 'CI/CD pipelines from commit to deploy.',
    category: 'Platform',
    status: 'enabled',
    docs: `${DOCS}/pipelines`,
    kind: 'module',
    routes: [{ path: '', component: PipelinesModule }],
  },
  {
    // CUSTOMER self-service — provision a dedicated DOKS cluster and manage its node
    // pools (add / scale / delete) over the native cloud `/v1/clusters*` surface,
    // org-scoped by the Bearer owner. Not admin-gated: a paying customer runs their
    // own clusters. The unified fleet cockpit (see + attach + connect) is Kubernetes.
    id: 'clusters',
    label: 'Clusters',
    icon: Network,
    description: 'Provision and manage your Kubernetes clusters and node pools.',
    category: 'Compute',
    status: 'enabled',
    repo: 'hanzoai/operator',
    kind: 'module',
    routes: [{ path: '', component: ClustersModule }],
  },
  {
    // CUSTOMER self-service — the UNIFIED COMPUTE FLEET: managed + attached BYO
    // clusters (with GPU inventory) MERGED from `GET /v1/clusters`, plus dialed-in
    // BYO machines from `GET /v1/machines`, and the three connect actions (attach a
    // BYO cluster via `POST /v1/clusters`, connect a box via `hanzo gpu connect`,
    // connect a cloud account — coming). Org-scoped by the Bearer owner; honest states.
    id: 'kubernetes',
    label: 'Kubernetes',
    icon: Boxes,
    description: 'Your unified compute fleet — clusters, GPUs, and connected machines.',
    category: 'Compute',
    status: 'enabled',
    repo: 'hanzoai/operator',
    kind: 'module',
    routes: [
      { path: '', component: KubernetesModule },
      { path: ':tab', component: KubernetesModule },
    ],
  },

  // ── Observe ──────────────────────────────────────────────────────────
  {
    id: 'usage',
    label: 'Usage',
    icon: Coins,
    description: "Your organization's total footprint — spend by category, LLM usage, and compute — in one place, with CSV export.",
    category: 'Billing',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    docs: `${DOCS}/usage`,
    kind: 'module',
    routes: [{ path: '', component: UsageModule }],
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: ScrollText,
    description: 'Structured logs across all services.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    docs: `${DOCS}/logs`,
    kind: 'module',
    routes: [{ path: '', component: LogsModule }],
  },
  {
    // Sentry-class error/crash tracking, folded into the ONE o11y plane over the
    // REAL /v1/o11y/errortracking surface: grouped issues by fingerprint with
    // lifecycle (resolve/ignore/reopen). Honest RuntimeNotice when the runtime is
    // not initialized (503) or unrouted (404); never fabricated issues.
    id: 'errors',
    label: 'Errors',
    icon: AlertTriangle,
    description: 'Grouped exceptions and crashes across your services.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    docs: `${DOCS}/errors`,
    kind: 'module',
    routes: [
      { path: '', component: ErrorsModule },
      { path: ':id', component: ErrorsModule },
    ],
  },
  {
    // Hanzo Sentry — the full Sentry-parity error/log/trace product FACE, served at
    // sentry.<brand> as a host-branded shell of THIS console (config.shell). It is
    // the Sentry PRODUCT in Hanzo's identity + @hanzo/gui design system (never the
    // upstream Sentry look), over the `/v1/sentry` contract. `shell: 'sentry'` scopes
    // it to that face — HIDDEN from the full console nav (the console already has the
    // o11y `errors`/`logs`/`o11y`(traces) surfaces), shown ONLY inside sentry.<brand>.
    // ONE module, panels routed by `:tab` (+ a `:tab/:id` detail): '' = Issues,
    // discover, logs (owns the base slug → its own panel, not the shared sub-page),
    // traces, stats (Monitor), projects, members.
    id: 'sentry',
    label: 'Sentry',
    icon: AlertTriangle,
    description: 'Sentry-class error, log and trace monitoring — issues, discover, logs, traces, monitor, and projects.',
    gcp: 'Cloud Error Reporting',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    shell: 'sentry',
    kind: 'module',
    // The panel sub-pages ARE the SentryModule tab strip (`SENTRY_TABS`) minus the
    // Issues index (`id: ''`) — ONE source, so the sidebar face nav and the module's
    // own tabs can never drift.
    subpages: SENTRY_TABS.filter((t) => t.id !== '').map((t) => ({ slug: t.slug, label: t.label, icon: t.icon })),
    routes: [
      { path: '', component: SentryModule },
      { path: ':tab', component: SentryModule },
      { path: ':tab/:id', component: SentryModule },
    ],
  },
  {
    id: 'metrics',
    label: 'Metrics',
    icon: BarChart3,
    description: 'Live platform service health and infrastructure metrics.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    docs: `${DOCS}/metrics`,
    kind: 'module',
    routes: [{ path: '', component: MetricsModule }],
  },
  {
    // Console-native traces — list + detail (observations, scores, I/O) on the
    // REAL /v1/o11y/traces surface. Honest RuntimeNotice when the runtime is not
    // initialized (503) or unrouted (404); never fabricated spans or costs.
    id: 'o11y',
    label: 'Traces',
    icon: Activity,
    description: 'End-to-end LLM and agent traces.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    docs: `${DOCS}/traces`,
    kind: 'module',
    routes: [
      { path: '', component: TracesModule },
      { path: ':id', component: TracesModule },
    ],
  },
  {
    id: 'service-map',
    label: 'Service Map',
    icon: Waypoints,
    description: 'Per-service RED metrics and the live dependency graph.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    kind: 'module',
    routes: [{ path: '', component: ServiceMapModule }],
  },
  {
    // Native — the org's AI usage at a glance: requests, tokens, spend, and
    // balance over a 24h/7d/30d window, a per-day chart, a per-model breakdown,
    // and recent activity. REAL per-org data from the commerce usage ledger
    // (GET /v1/billing/usage via the per-tenant /billing proxy), joined to the
    // model catalog for display names + pricing. The o11y RuntimeNotice links
    // here when traces aren't initialized, since THIS page has data today.
    id: 'ai-metrics',
    label: 'AI Metrics',
    icon: BarChart3,
    description: 'Requests, tokens, spend, and per-model usage for your org.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/ai',
    docs: `${DOCS}/billing`,
    kind: 'module',
    // The ONE canonical <UsagePanel> (@hanzo/usage/react) over the server-owned
    // GET /v1/get-cloud-usages overview — no bespoke re-derivation, the same panel
    // every Hanzo surface renders.
    routes: [{ path: '', component: AiUsageModule }],
  },
  {
    // Open Edition (run-for-pay): the customer's view of their open-source
    // workload spend, over the SAME real commerce usage ledger scoped to the
    // run-for-pay product tag. Spend billed = cost + 25% (the served revenue R).
    // Canonical: docs/architecture/run-for-pay-pricing.md.
    id: 'open-edition',
    label: 'Open Edition',
    icon: TrendingUp,
    description: 'Run open-source workloads for pay — spend billed at cost + 25%, tokens, and per-model usage.',
    gcp: 'Marketplace / pay-as-you-go',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    docs: `${DOCS}/billing`,
    kind: 'module',
    routes: [{ path: '', component: OpenEditionLiving }],
  },
  {
    // Native Analytics — per-org LLM + web + commerce analytics over the unified
    // Hanzo Datastore warehouse, read through cloud-api /v1/analytics/* via
    // the /v1 bearer proxy (the FOUR real routes: overview/timeseries/top/health).
    // Overview (LLM lens REAL from hanzo.cloud_usage; web/commerce honest-empty until
    // the events collector emits) + LLM (top models) — every metric a real query,
    // never fabricated. See universe/docs/architecture/unified-analytics.md.
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    description: 'Per-org web, commerce, and LLM analytics over the unified warehouse.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/analytics',
    docs: `${DOCS}/analytics`,
    kind: 'module',
    routes: [
      { path: '', component: AnalyticsModule },
      { path: ':tab', component: AnalyticsModule },
    ],
    subpages: [{ slug: 'llm', label: 'LLM' }],
  },
  {
    id: 'dashboards',
    label: 'Dashboards',
    icon: LineChart,
    description: 'Product analytics and observability dashboards.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/analytics',
    docs: `${DOCS}/dashboards`,
    kind: 'module',
    routes: [
      { path: '', component: DashboardsModule },
      { path: ':tab', component: DashboardsModule },
    ],
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: Bell,
    description: 'Alerting rules and notification policies.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    kind: 'module',
    routes: [{ path: '', component: AlertsModule }],
  },
  {
    // The unified Billing Center — the ONE GCP-Cloud-Billing-style money surface.
    // A tabbed product (Overview · Reports · Budgets · Invoices · Subscriptions ·
    // Payment methods · Credits) over the per-tenant `/billing/*` commerce proxy.
    // SUPERSEDES the old scattered Cost / Subscriptions / Payment-methods entries
    // (folded in as tabs — one center, zero duplication). It is ALSO the whole
    // surface shown in billing-only shell mode at billing.<brand> (SAME component,
    // filtered nav + default route), so console and billing.hanzo.ai are 1:1.
    id: 'billing',
    label: 'Billing',
    icon: CreditCard,
    description: 'Balance, spend, budgets, invoices, subscriptions, and payment methods.',
    gcp: 'Cloud Billing',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/commerce',
    docs: `${DOCS}/billing`,
    kind: 'module',
    routes: [
      { path: '', component: BillingModule },
      { path: ':tab', component: BillingModule },
    ],
    subpages: [
      { slug: 'reports', label: 'Reports' },
      { slug: 'accounts', label: 'Accounts' },
      { slug: 'budgets', label: 'Budgets' },
      { slug: 'invoices', label: 'Invoices' },
      { slug: 'subscriptions', label: 'Subscriptions' },
      { slug: 'payment-methods', label: 'Payment methods' },
      { slug: 'credits', label: 'Credits' },
    ],
  },
  {
    // The signed-in org's per-tenant view of the UNIFIED finance ledger (hanzoai/
    // finance, embedded in cloud): balance, metered spend, credits, invoices, payment
    // methods, and the double-entry ledger, over /v1/finance/* scoped to the caller's
    // org (the `/v1` bearer proxy resolves the org from the token owner). Renders the
    // SHARED @hanzo/finance-ui board — the SAME component finance.hanzo.ai renders — so
    // a spend/usage/credits card is identical across both surfaces (the shared-reuse
    // point). Distinct id from the admin `finance` platform-FinOps board (admin: true)
    // and from `billing` (the commerce money surface); this is the native-ledger read.
    id: 'finance-center',
    label: 'Finance',
    icon: Wallet,
    description: 'Your organization’s ledger, spend, credits, invoices, and payment methods.',
    gcp: 'Cloud Billing / FinOps',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/finance',
    kind: 'module',
    routes: [{ path: '', component: FinanceModule }],
  },
  {
    // Real, enabled — the all-services health view, from real cluster data.
    id: 'status',
    label: 'Status',
    icon: Gauge,
    description: 'Live health of every Hanzo service across your clusters.',
    category: 'Observe',
    status: 'enabled',
    // GLOBAL-ADMIN ONLY (`admin: true`): the board reads the whole platform's
    // VictoriaMetrics `up{}` inventory through the SuperAdmin-gated cloud VM proxy
    // (`/v1/o11y/vm/*`, clients/o11y/vmproxy.go), which 403s a non-super caller. So a
    // customer gets the graceful AdminManagedNotice (no proxy call, no console 403)
    // instead of an error card, and only a SuperAdmin renders StatusModule + the board.
    admin: true,
    repo: 'hanzoai/operator',
    kind: 'module',
    routes: [{ path: '', component: StatusModule }],
  },
  {
    // Real, enabled — compare plans and pricing (live /v1/pricing). Paying
    // happens in Cost/Billing (the one money surface); this never charges.
    id: 'plans',
    label: 'Plans & Pricing',
    icon: Tag,
    description: 'Compare plans and pricing for every cloud service.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/billing',
    kind: 'module',
    routes: [{ path: '', component: PlansModule }],
  },

  // ── Web3 ─────────────────────────────────────────────────────────────
  {
    // Trading — deploy + manage the Lux DEX trading bots (the market-maker + the
    // trader) as native cloud apps. Lists the org's deployed bots, shows each one's
    // LIVE quote quality (the maker's :2112 metrics) + the DEX order book, and
    // controls them (deploy from a config form → the PaaS BuildKit, start/stop,
    // redeploy, logs). Data is brand-scoped in the /trading proxy (lux.cloud sees
    // only Lux networks). The bots are ordinary PaaS git apps — one deploy path.
    id: 'trading',
    label: 'Trading',
    icon: LineChart,
    description: 'Deploy and manage the Lux DEX market-maker and trader bots — live quote quality, order book, and controls.',
    category: 'Web3',
    status: 'enabled',
    repo: 'luxfi/maker',
    kind: 'module',
    routes: [
      { path: '', component: TradingModule },
      { path: ':name', component: TradingModule },
    ],
  },
  {
    // Markets — the Lux DEX economy dashboard (the DeFiLlama-style analytics plane).
    // The reusable LivingOverview KPI board (active markets, 24h volume/trades, book
    // depth, per-market donuts, recent trades, maker health) + the per-market table,
    // both over the `dex` subgraph via the session-gated, brand-scoped /economy proxy.
    // Honest to the CLOB reality (book depth, not pooled USD TVL); honest-empty until
    // the indexer reports. The analytics twin of the Trading (deploy/manage) module.
    id: 'markets',
    label: 'Markets',
    icon: BarChart3,
    description: 'The Lux DEX economy — TVL/depth, 24h volume, fees, per-market price and liquidity, and recent trades from the on-chain indexer.',
    category: 'Web3',
    status: 'enabled',
    repo: 'luxfi/graph',
    kind: 'module',
    routes: [{ path: '', component: MarketsModule }],
  },
  {
    id: 'settlement',
    label: 'Settlement',
    icon: ArrowLeftRight,
    description: 'On-chain settlement for compute and payouts.',
    category: 'Web3',
    status: 'enabled',
    repo: 'hanzoai/ledger',
    docs: `${DOCS}/blockchain`,
    kind: 'module',
    routes: [{ path: '', component: SettlementModule }],
  },
  {
    // Real, enabled — connect a wallet on Hanzo Mainnet, view HUSD + cloud
    // credit, and top up credit with HUSD (same-origin verify-and-record seam).
    id: 'wallet',
    label: 'Wallets',
    icon: Wallet,
    description: 'Connect a wallet and top up cloud credit with HUSD.',
    category: 'Web3',
    status: 'enabled',
    repo: 'hanzoai/billing',
    kind: 'module',
    routes: [{ path: '', component: WalletModule }],
  },
  {
    id: 'referrals',
    label: 'Referrals',
    icon: Gift,
    description: 'Share your referral link and earn cloud credit when organizations get started.',
    category: 'Web3',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    // Single screen (link + copy, stat tiles, referrals list); the shared base
    // sub-pages (status/logs/metrics/settings) resolve via the catch-all.
    routes: [{ path: '', component: ReferralsModule }],
  },
  {
    // Global-admin operator board (hidden from every customer nav/palette).
    id: 'referrals-admin',
    label: 'Referrals',
    icon: Gift,
    description: 'Fleet-wide referral program — invites, qualification, and credit granted.',
    category: 'Observe',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: ReferralsAdminModule }],
  },
  {
    id: 'affiliates',
    label: 'Affiliates',
    icon: Handshake,
    description: 'Partner with Hanzo — earn ongoing commission on the customers you refer.',
    category: 'Web3',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    // Apply form (not enrolled) / dashboard (code + link, stat tiles, payout history);
    // the shared base sub-pages (status/logs/metrics/settings) resolve via the catch-all.
    routes: [{ path: '', component: AffiliatesModule }],
  },
  {
    // Global-admin operator board (hidden from every customer nav/palette).
    id: 'affiliates-admin',
    label: 'Affiliates',
    icon: Handshake,
    description: 'Partner-commission program — applications, accrual, and payouts.',
    category: 'Observe',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: AffiliatesAdminModule }],
  },
  {
    id: 'authors',
    label: 'Authors',
    icon: BookOpen,
    description: 'Earn when your open-source project is deployed on Hanzo.',
    // Dev, not Web3: the audience is open-source developers shipping code, and the
    // subject is their project. A wallet is how the payout arrives — the mechanism,
    // not the category. Filing it under Web3 hid it from everyone it is meant for.
    category: 'Dev',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    // Connect GitHub (not enrolled) / dashboard (repos + verify, deploys, payouts);
    // the shared base sub-pages (status/logs/metrics/settings) resolve via the catch-all.
    routes: [{ path: '', component: AuthorsModule }],
  },
  {
    // Global-admin operator board (hidden from every customer nav/palette).
    id: 'authors-admin',
    label: 'Authors',
    icon: BookOpen,
    description: 'OSS-author royalty program — verifications, deploys, accruals, payouts.',
    category: 'Observe',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: AuthorsAdminModule }],
  },
  {
    // Super-admin per-org entitlements editor (hidden from every customer nav/
    // palette). Masquerade into an org, then toggle which products its
    // console shows — the admin half of the out-of-box "assemble your own backend"
    // flow. Reads/writes /v1/orgs/{org}/entitlements (org-scoped server-side).
    id: 'entitlements',
    label: 'Entitlements',
    icon: ShieldCheck,
    description: "Manage which products the active organization has enabled.",
    category: 'Settings',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: EntitlementsAdminModule }],
  },
  {
    // Global-admin reserve-fund board (hidden from every customer nav/palette).
    id: 'treasury',
    label: 'Treasury',
    icon: Landmark,
    description: 'Platform reserve fund — revenue-share policy, backed growth-loop payouts, double-entry journal, Hanzo L1 anchor.',
    category: 'Observe',
    status: 'enabled',
    admin: true,
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: TreasuryAdminModule }],
  },
  {
    id: 'tokens',
    label: 'Tokens',
    icon: Coins,
    description: 'Issue and manage tokens and balances.',
    category: 'Web3',
    status: 'enabled',
    repo: 'hanzoai/treasury',
    kind: 'module',
    routes: [{ path: '', component: TokensModule }],
  },
  {
    // Bootnode ("Web3 Backend in a Box") blockchain networks — the core web3
    // provisioning primitive, surfaced in the lux/zoo web3 consoles. Reads the
    // real bootnode control plane via console2's /bootnode proxy (honest states).
    id: 'networks',
    label: 'Networks',
    icon: Blocks,
    description: 'Blockchain networks — chain, nodes, status, and RPC.',
    category: 'Web3',
    status: 'enabled',
    repo: 'hanzoai/bootnode',
    docs: `${DOCS}/networks`,
    kind: 'module',
    routes: [{ path: '', component: NetworksModule }],
  },
  {
    id: 'indexer',
    label: 'Indexer',
    icon: Database,
    description: 'Index and query on-chain data.',
    category: 'Web3',
    status: 'enabled',
    kind: 'module',
    routes: [{ path: '', component: IndexerModule }],
  },
  {
    id: 'oracles',
    label: 'Oracles',
    icon: Radio,
    description: 'Bring off-chain data on-chain.',
    category: 'Web3',
    status: 'enabled',
    kind: 'module',
    routes: [{ path: '', component: OraclesModule }],
  },
  {
    id: 'attestations',
    label: 'Attestations',
    icon: ShieldCheck,
    description: 'Verifiable attestations and proofs.',
    category: 'Web3',
    status: 'enabled',
    kind: 'module',
    routes: [{ path: '', component: AttestationsModule }],
  },

  {
    // console.lux.cloud LUX NETWORK board — the SuperAdmin infrastructure/investor
    // view of the REAL luxd + lux-k8s fleet: validators (per-network up/height/peers/
    // bootstrapped, the mainnet primary highlighted with its 2.5B LUX stake), node +
    // pod memory pressure, and the named-service status grid. In-console `module`
    // (owns its route), reading the SuperAdmin-gated, allowlisted cloud VM proxy
    // (lib/api/lux-infra.ts → /v1/o11y/vm/query). SUPERADMIN + LUX ONLY: `admin: true`
    // hides it from every customer and the module renders SuperAdminRequired for a
    // non-SuperAdmin; `brands: ['lux']` keeps it OFF every non-Lux console (zero
    // cross-brand leak). The cloud proxy (admin(c) + fixed allowlist) is the
    // authoritative server gate. Honest by construction — every value folds real
    // telemetry, on-chain uptime is labeled a tracker bug, nothing fabricated.
    id: 'lux-network',
    label: 'Lux Network',
    icon: Waypoints,
    description: 'Live validators, node and pod memory, and Lux service health across the fleet — real telemetry.',
    category: 'Web3',
    status: 'enabled',
    admin: true,
    brands: ['lux'],
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: LuxNetworkModule }],
  },
  // ── Web3 · Chain apps — launch tiles for the DEPLOYED Lux / Zoo dApp suite.
  //    These are standalone web3 apps that live at their OWN domains (owned by
  //    the Lux / Zoo products, not Hanzo control planes), so they are `external`
  //    launch tiles — `openProduct` opens `href` in a new tab, never a rebuilt
  //    in-console surface. Per-brand `brands` keeps them from cross-leaking: the
  //    Lux tiles show only on lux.cloud, the Zoo tiles only on zoo.cloud.
  //    Every href is a real, verified deployment — no fabricated URLs.
  {
    id: 'lux-explorer',
    label: 'Explorer',
    icon: Compass,
    description: 'Lux Network block explorer — search transactions, addresses, and contracts.',
    category: 'Web3',
    status: 'enabled',
    brands: ['lux'],
    kind: 'external',
    href: 'https://explore.lux.network',
  },
  {
    id: 'lux-exchange',
    label: 'Exchange',
    icon: ArrowLeftRight,
    description: 'Trade digital assets on the Lux exchange.',
    category: 'Web3',
    status: 'enabled',
    brands: ['lux'],
    kind: 'external',
    href: 'https://lux.exchange',
  },
  {
    id: 'lux-bridge',
    label: 'Bridge',
    icon: Waypoints,
    description: 'Bridge assets across chains on the Lux Network.',
    category: 'Web3',
    status: 'enabled',
    brands: ['lux'],
    kind: 'external',
    href: 'https://bridge.lux.network',
  },
  {
    id: 'lux-faucet',
    label: 'Faucet',
    icon: Droplet,
    description: 'Claim testnet tokens for building on Lux.',
    category: 'Web3',
    status: 'enabled',
    brands: ['lux'],
    kind: 'external',
    href: 'https://faucet.lux.network',
  },
  {
    id: 'lux-safe',
    label: 'Safe',
    icon: Shield,
    description: 'Multisig smart-contract wallet on Lux (Safe).',
    category: 'Web3',
    status: 'enabled',
    brands: ['lux'],
    kind: 'external',
    href: 'https://safe.lux.finance',
  },
  {
    id: 'lux-dex',
    label: 'DEX',
    icon: Coins,
    description: 'Swap tokens on the Lux on-chain decentralized exchange.',
    category: 'Web3',
    status: 'enabled',
    brands: ['lux'],
    kind: 'external',
    href: 'https://dex.lux.network',
  },
  {
    id: 'lux-wallet',
    label: 'Wallet',
    icon: Wallet,
    description: 'Manage your assets across the Lux C, P, and X chains.',
    category: 'Web3',
    status: 'enabled',
    brands: ['lux'],
    kind: 'external',
    href: 'https://wallet.lux.network',
  },
  {
    id: 'zoo-explorer',
    label: 'Explorer',
    icon: Compass,
    description: 'Zoo Network block explorer — search transactions, addresses, and contracts.',
    category: 'Web3',
    status: 'enabled',
    brands: ['zoo'],
    kind: 'external',
    href: 'https://explore.zoo.network',
  },
  {
    id: 'zoo-exchange',
    label: 'Exchange',
    icon: ArrowLeftRight,
    description: 'Trade digital assets on the Zoo exchange.',
    category: 'Web3',
    status: 'enabled',
    brands: ['zoo'],
    kind: 'external',
    href: 'https://zoo.exchange',
  },
  {
    id: 'zoo-bridge',
    label: 'Bridge',
    icon: Waypoints,
    description: 'Bridge assets across chains on the Zoo Network.',
    category: 'Web3',
    status: 'enabled',
    brands: ['zoo'],
    kind: 'external',
    href: 'https://bridge.zoo.ngo',
  },

  // ── Apps ─────────────────────────────────────────────────────────────
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    description: 'AI chat with Zen models, third-party models, and MCP tools.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/chat',
    docs: `${DOCS}/chat`,
    kind: 'module',
    routes: [
      { path: '', component: ChatModule },
      // `:owner/:name` carries the chat's real owner (2 segs); `:name` (1 seg) is the
      // legacy single-segment link, owner defaulting to the active org. Unambiguous by
      // segment count.
      { path: ':owner/:name', component: ChatModule },
      { path: ':name', component: ChatModule },
    ],
  },
  {
    id: 'bot',
    label: 'Bot',
    icon: Bot,
    description: 'Agent gateway — channels, skills, and an OpenAI-compatible API.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/bot',
    kind: 'module',
    // '' = the gateway status/deep-links; 'run' = launch a computer-using bot on a
    // booted machine and watch it live over VNC (cloud POST /v1/bots/run, metered).
    routes: [
      { path: '', component: BotModule },
      { path: 'run', component: BotsConsole },
    ],
  },
  {
    // Guide — the Business AI Guide (cloud clients/guide, /v1/guide/*): an interactive
    // launch checklist every org completes on-site. A curriculum drives the steps,
    // per-org progress tracks a state per step, and the Business AI can DO a step for
    // you (streamed). Foundational onboarding — always-on for every org (entitlements).
    id: 'guide',
    label: 'Guide',
    icon: Compass,
    description: 'Your interactive launch checklist — the Business AI can do each step for you.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    // Overview ('') renders the whole guide; ':tab' is reserved for future sub-tabs
    // and deep-links a specific step open (params.tab → the expanded step).
    routes: [
      { path: '', component: GuideModule },
      { path: ':tab', component: GuideModule },
    ],
  },
  {
    // CRM — the first Hanzo Business-OS brick, over the native-Go cloud `/v1/crm`
    // surface (cloud clients/crm on Base/SQLite: companies/contacts/opportunities,
    // a port of Twenty's core model). Per-org through the user-bearer /v1 bearer BFF.
    id: 'crm',
    label: 'CRM',
    icon: Building2,
    description: 'Companies, contacts, and opportunities — your Business-OS CRM, per org.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    // The index IS Companies (`/crm`); the other two collections render via the
    // `:tab` route (`/crm/{contacts,opportunities}`). A bookmarked
    // `/crm/companies` still resolves — the module falls back to Companies — but
    // the nav offers ONE URL per screen.
    routes: [
      { path: '', component: CrmModule },
      { path: ':tab', component: CrmModule },
    ],
    indexLabel: 'Companies',
    subpages: [
      { slug: 'contacts', label: 'Contacts', icon: Users },
      { slug: 'opportunities', label: 'Opportunities', icon: Target },
    ],
  },
  {
    // Company — self-service incorporation over the REAL cloud `/v1/company` surface
    // (native-Go `clients/company`: an 8-stage formation state machine on Base/SQLite).
    // The wizard renders the panel for the formation's CURRENT stage (the backend is the
    // source of truth) and advances through the guarded transition door; KYC/e-sign/filing
    // report honest "pending — manual review" while those providers are stubs. The company
    // SIDE only (formation + the org's own cap table) — a securities raise runs elsewhere.
    id: 'company',
    label: 'Company',
    icon: Landmark,
    description: 'Incorporate your company — an 8-step formation wizard, from entity to equity genesis.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: CompanyModule }],
  },
  {
    // Cap Table — the per-org capitalization ledger over the REAL cloud `/v1/captable`
    // surface (native-Go `clients/captable`, HIP-0106: the Captable,Inc logic on a goja
    // bundle over per-tenant Base/SQLite). Tabs: the computed ownership Summary,
    // Stakeholders, Shares (issued certificates), Classes, and Fundraising (SAFEs + rounds);
    // the cap-table math is computed SERVER-SIDE (the `summary` route), never in the client.
    id: 'captable',
    label: 'Cap Table',
    icon: Coins,
    description: 'Your capitalization ledger — stakeholders, share classes, issued equity, SAFEs, and rounds.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    // Summary ('') is the computed cap table; the five lenses render via the `:tab` route
    // the module targets (`/captable/{stakeholders,shares,classes,fundraising}`).
    routes: [
      { path: '', component: CapTableModule },
      { path: ':tab', component: CapTableModule },
    ],
    indexLabel: 'Summary',
    subpages: [
      { slug: 'stakeholders', label: 'Stakeholders', icon: Users },
      { slug: 'shares', label: 'Shares', icon: ScrollText },
      { slug: 'classes', label: 'Classes', icon: Layers },
      { slug: 'fundraising', label: 'Fundraising', icon: TrendingUp },
    ],
  },
  {
    // Marketing — the in-process fold of github.com/hanzoai/marketing over the REAL
    // native-Go cloud `/v1/marketing` surface (cloud clients/marketing on Base/SQLite:
    // a per-org campaign store, twin of clients/crm). The host→mode twin of the Billing
    // Center: marketing.hanzo.ai boots THIS product alone (config.marketingOnly). Per-org,
    // honest-empty by construction — every state is loading / BackendStateCard / empty.
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    description: 'Campaigns across channels (email, social, ads) — your marketing surface, per org.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: MarketingModule }],
  },
  {
    // Ads — the net-new Ads product over the REAL native-Go cloud `/v1/ads` surface
    // (cloud clients/ads on Base/SQLite: a per-org ad-campaign store, twin of
    // clients/crm). The host→mode twin of the Billing Center: ads.hanzo.ai boots
    // THIS product alone (config.adsOnly). Per-org, honest-empty by construction —
    // every state is loading / BackendStateCard / empty.
    id: 'ads',
    label: 'Ads',
    icon: Target,
    description: 'Ad campaigns across platforms (Meta, Google, TikTok, X) — your ads surface, per org.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: AdsModule }],
  },
  {
    // Publish (formerly "Social") — the in-process fold of the live social stack
    // (github.com/hanzoai/social: social-backend/frontend/orchestrator, a Postiz-style
    // scheduler) over the REAL native-Go cloud `/v1/social` surface (cloud clients/social
    // on Base/SQLite: a per-org accounts+posts store, twin of clients/crm). The host→mode
    // twin of the Billing Center: social.hanzo.ai boots THIS product alone
    // (config.socialOnly). Per-org, honest-empty by construction — every state is loading
    // / BackendStateCard / empty. DISPLAY renamed to "Publish"; the internal id 'social',
    // the /v1/social seam, and the social.hanzo.ai host mapping are UNCHANGED (one seam,
    // one name for the value — only the label moved).
    id: 'social',
    label: 'Publish',
    icon: Share2,
    description: 'Queue and publish your content everywhere — schedule and post across networks (X, Instagram, LinkedIn, TikTok), per org.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: SocialModule }],
  },
  {
    // Startups — the Hanzo Startup Program pipeline, over the native-Go cloud
    // `/v1/crm/applications` surface (cloud clients/crm on Base/SQLite). Public
    // marketing form → AI screen → staff pipeline board. Per-org (hanzo).
    id: 'startups',
    label: 'Startups',
    icon: Rocket,
    description: 'Startup Program applications — AI-screened pipeline board, per org.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [{ path: '', component: StartupsModule }],
  },
  {
    // Content — a NATIVE CMS on the Hanzo Framework DocType engine (/v1/framework/*),
    // NOT an iframe. A collection is a framework DocType (module "cms"); a content entry
    // is a framework document; publishing is a status field. Rendered by the generic,
    // metadata-driven DocType renderer (src/components/doctype/*) over the ONE framework
    // client — the DRY foundation ERP/Helpdesk reuse. Per-org, honest-empty by construction.
    id: 'cms',
    label: 'Content',
    icon: FileText,
    description: 'Native CMS — pages, posts, articles, media, and navigation as DocTypes on the Hanzo Framework, per organization.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [
      { path: '', component: CmsModule },
      { path: 'collections/:doctype', component: CmsModule },
      { path: 'collections/:doctype/:name', component: CmsModule },
    ],
  },
  {
    // ERP — a NATIVE ERP on the Hanzo Framework DocType engine (/v1/framework/*), NOT
    // an iframe. A master/transaction is a framework DocType (module "erp"); posting
    // (stock ledger, balanced GL) is a native-Go hook on the engine (clients/erp).
    // Rendered by the generic metadata-driven DocType renderer (src/components/doctype/*),
    // per-org — the SAME renderer as CMS, with zero ERP-specific UI code.
    id: 'erp',
    label: 'ERP',
    icon: Boxes,
    description: 'Native ERP on the Hanzo Framework — items, sales, purchasing, accounting, and HR as DocTypes, per organization.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [
      { path: '', component: ErpModule },
      { path: 'collections/:doctype', component: ErpModule },
      { path: 'collections/:doctype/:name', component: ErpModule },
    ],
  },
  {
    // Help Center — a NATIVE support desk on the Hanzo Framework DocType engine
    // (/v1/framework/*), NOT an iframe. A ticket is a framework document (module
    // "help"); its lifecycle is a status field; agents/teams/SLAs are DocTypes
    // (clients/help — pure fixtures, no hooks). Rendered by the generic
    // metadata-driven DocType renderer, per-org — the SAME renderer as CMS/ERP.
    id: 'helpdesk',
    label: 'Help Center',
    icon: LifeBuoy,
    description: 'Native support desk on the Hanzo Framework — tickets, agents, teams, and SLAs as DocTypes, per organization.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    kind: 'module',
    routes: [
      { path: '', component: HelpModule },
      { path: 'collections/:doctype', component: HelpModule },
      { path: 'collections/:doctype/:name', component: HelpModule },
    ],
  },
  {
    // Accessibility — a Wix-style WCAG checker for the site Dave is building. Runs
    // Deque's axe-core against the current page 100% client-side (engine lazy-loaded
    // into its own chunk); pure sort/summarize logic lives in ~/lib/a11y/scan.
    id: 'accessibility',
    label: 'Accessibility',
    icon: Accessibility,
    description: 'Scan the current page for WCAG accessibility issues — axe-core, in your browser.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: AccessibilityModule }],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: Store,
    description: 'Browse and deploy AI models & providers — real pricing, live availability.',
    gcp: 'Marketplace',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/console',
    docs: `${DOCS}/marketplace`,
    kind: 'module',
    routes: [{ path: '', component: MarketplaceModule }],
  },
  {
    id: 'search',
    label: 'Search',
    icon: Search,
    description: 'Managed search — full-text & hybrid indexes.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/search',
    docs: `${DOCS}/search`,
    kind: 'module',
    routes: resourceRoutes({ kind: 'search', productLabel: 'Hanzo Search', connectionHint: 'Use the Search host + key from the connection string.' }),
  },
  {
    // Web Search — the LIVE self-hosted web-search product (SearXNG meta-search +
    // Crawl4AI scrape), served by cloud at `/v1/websearch/*`. A tabbed control panel:
    // live health (a real search probe — no health endpoint), a live Try-Search box
    // over `/v1/websearch/search`, the API reference (both endpoints + curl + how to
    // use it in Chat), the deployed engine set (read-only), and the honest deployed
    // config. Self-hosted, no third-party keys; usage is honestly "not metered yet".
    id: 'websearch',
    label: 'Web Search',
    icon: Search,
    description: 'Search and crawl the web for your agents — self-hosted, no third-party keys.',
    gcp: 'Programmable Search / Vertex AI Search',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    docs: `${DOCS}/crawl`,
    kind: 'module',
    // `:tab` sub-routes (Overview/Try Search/API/Engines/Config) resolve inside the
    // module, exactly like Functions/GPUs/Models — one route entry, tabbed content.
    // The declared specifics are NON-base slugs so they never collide with the shared
    // Settings/Status/Logs/Metrics base sub-pages (which render real deployment facts).
    routes: [
      { path: '', component: SearchModule },
      { path: ':tab', component: SearchModule },
    ],
    subpages: [
      { slug: 'search', label: 'Try Search' },
      { slug: 'api', label: 'API' },
      { slug: 'engines', label: 'Engines' },
      { slug: 'config', label: 'Config' },
    ],
  },
  {
    // Crawl — the web-to-markdown extraction half of the self-hosted web-search
    // product (Crawl4AI). It is served by the SAME `/v1/websearch/*` subsystem as Web
    // Search, so the Crawl entry renders the SAME `SearchModule` (its API tab documents
    // the scrape endpoint) — one module for the one product, cross-linked, never a
    // duplicate surface. (Was a native-overview stub; upgraded to the real panel.)
    id: 'crawl',
    label: 'Crawl',
    icon: Globe,
    description: 'Crawl and extract the web to clean markdown for your agents — self-hosted (Crawl4AI).',
    gcp: 'Web crawl',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/cloud',
    docs: `${DOCS}/crawl`,
    kind: 'module',
    routes: [
      { path: '', component: SearchModule },
      { path: ':tab', component: SearchModule },
    ],
    subpages: [
      { slug: 'search', label: 'Try Search' },
      { slug: 'api', label: 'API' },
      { slug: 'engines', label: 'Engines' },
      { slug: 'config', label: 'Config' },
    ],
  },
  {
    id: 'studio',
    label: 'Studio',
    icon: Sparkles,
    description: 'Build AI apps and pipelines visually.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/studio',
    docs: `${DOCS}/ai-studio`,
    kind: 'module',
    // The FULL Studio app, embedded (same-site iframe) — every capability
    // usable in-console; a brand with no instance gets the honest card.
    routes: [{ path: '', component: StudioModule }],
  },
  {
    id: 'templates',
    label: 'Templates',
    icon: Blocks,
    description: 'Production-ready starter kits — fork a template and deploy.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/gallery',
    kind: 'module',
    routes: [{ path: '', component: TemplatesModule }],
  },
  {
    id: 'console',
    label: 'Console',
    icon: Boxes,
    description: 'The unified cloud console — this app.',
    category: 'Apps',
    status: 'enabled',
    repo: 'hanzoai/console',
    docs: `${DOCS}/console`,
    kind: 'module',
    routes: overviewRoutes('console'),
  },

  // ── Commerce — the merchant store dashboard over hanzoai/commerce, per org ────
  //    Products/orders/customers/inventory/promotions read through console2's own
  //    user-bearer `/commerce` proxy (org-scoped server-side); payments (Square)
  //    stay in Billing. Each page is a native in-console module — no subdomain.
  {
    id: 'products',
    label: 'Products',
    icon: Package,
    description: 'Your store catalog — items customers can buy.',
    gcp: 'Commerce',
    category: 'Commerce',
    status: 'enabled',
    repo: 'hanzoai/commerce',
    docs: `${DOCS}/commerce`,
    kind: 'module',
    routes: [{ path: '', component: StoreProductsModule }],
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: ClipboardList,
    description: 'Purchases placed in your store — status, customer, and total.',
    category: 'Commerce',
    status: 'enabled',
    repo: 'hanzoai/commerce',
    docs: `${DOCS}/commerce`,
    kind: 'module',
    routes: [{ path: '', component: StoreOrdersModule }],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    description: 'People who order from or have an account with your store.',
    category: 'Commerce',
    status: 'enabled',
    repo: 'hanzoai/commerce',
    docs: `${DOCS}/commerce`,
    kind: 'module',
    routes: [{ path: '', component: StoreCustomersModule }],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    description: 'Stock on hand per SKU across your catalog.',
    category: 'Commerce',
    status: 'enabled',
    repo: 'hanzoai/commerce',
    docs: `${DOCS}/commerce`,
    kind: 'module',
    routes: [{ path: '', component: StoreInventoryModule }],
  },
  {
    id: 'promotions',
    label: 'Promotions',
    icon: Tag,
    description: 'Discount codes and promotions customers apply at checkout.',
    category: 'Commerce',
    status: 'enabled',
    repo: 'hanzoai/commerce',
    docs: `${DOCS}/commerce`,
    kind: 'module',
    routes: [{ path: '', component: StorePromotionsModule }],
  },
  {
    id: 'storefront',
    label: 'Store settings',
    icon: Store,
    description: 'Storefront configuration and how payments are processed.',
    category: 'Commerce',
    status: 'enabled',
    repo: 'hanzoai/commerce',
    docs: `${DOCS}/commerce`,
    kind: 'module',
    routes: [{ path: '', component: StoreSettingsModule }],
  },

  // ── Appended modules — ported from hanzoai/console (settings/models + eval engine).
  //    Grouped by `category` (not array position); no entry above is reordered.
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: KeySquare,
    description: 'The cloud API credential for your account — SDKs, CLI, gateway.',
    category: 'Dev',
    status: 'enabled',
    repo: 'hanzoai/iam',
    docs: `${DOCS}/api`,
    kind: 'module',
    routes: [{ path: '', component: ApiKeysModule }],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SlidersHorizontal,
    description: 'Organization and account settings — name, defaults, and branding.',
    category: 'Settings',
    status: 'enabled',
    repo: 'hanzoai/iam',
    kind: 'module',
    routes: [
      { path: '', component: SettingsModule },
      { path: ':tab', component: SettingsModule },
    ],
    indexLabel: 'General',
    subpages: [{ slug: 'branding', label: 'Branding' }],
  },
  {
    id: 'contact',
    label: 'Contact',
    icon: LifeBuoy,
    description: 'Reach support, sales, and the Hanzo community — the in-console assistant answers first.',
    category: 'Settings',
    status: 'enabled',
    repo: 'hanzoai/console',
    kind: 'module',
    routes: [{ path: '', component: ContactModule }],
  },
  {
    id: 'prompts',
    label: 'Prompts',
    icon: FileText,
    description: 'Versioned prompts with labels and history.',
    category: 'AI',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    docs: `${DOCS}/prompts`,
    kind: 'module',
    routes: [
      { path: '', component: PromptsModule },
      { path: 'new', component: PromptCreateModule },
      { path: 'metrics', component: PromptMetricsModule },
      { path: ':name', component: PromptsModule },
    ],
    subpages: [{ slug: 'metrics', label: 'Metrics' }],
  },
  {
    id: 'datasets',
    label: 'Datasets',
    icon: Database,
    description: 'Curate evaluation datasets and items.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    docs: `${DOCS}/datasets`,
    kind: 'module',
    routes: [
      { path: '', component: DatasetsModule },
      { path: 'items', component: DatasetItemsModule },
      { path: 'runs', component: DatasetRunsModule },
    ],
    subpages: [
      { slug: 'items', label: 'Items' },
      { slug: 'runs', label: 'Runs' },
    ],
  },
  {
    id: 'experiments',
    label: 'Experiments',
    icon: Workflow,
    description: 'Dataset runs, comparisons, and experiment analytics.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    docs: `${DOCS}/experiments`,
    kind: 'module',
    routes: [
      { path: '', component: ExperimentsModule },
      { path: ':tab', component: ExperimentsModule },
    ],
  },
  // ── Observe (appended — grouped by `category`, not array position, so these
  //    render under Observe without reordering existing entries). Native trace
  //    siblings on the REAL /v1/o11y surface: sessions group traces; scores are
  //    evaluation results. Both render honest states when the runtime is 503.
  {
    id: 'sessions',
    label: 'Sessions',
    icon: MessageSquare,
    description: 'Traces grouped into multi-turn sessions.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    docs: `${DOCS}/sessions`,
    kind: 'module',
    routes: [
      { path: '', component: SessionsModule },
      { path: ':id', component: SessionsModule },
    ],
  },
  {
    id: 'scores',
    label: 'Scores',
    icon: ListChecks,
    description: 'Evaluation scores from feedback, graders, and review.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    docs: `${DOCS}/scores`,
    kind: 'module',
    routes: [
      { path: '', component: ScoresModule },
      { path: 'analytics', component: ScoreAnalyticsModule },
    ],
    subpages: [{ slug: 'analytics', label: 'Analytics' }],
  },
  {
    // Native — score DEFINITIONS (data type + valid range/categories) on the REAL
    // /v1/evals/rubrics surface. Read-only list; honest RuntimeNotice on 503.
    id: 'score-configs',
    label: 'Score Configs',
    icon: Ruler,
    description: 'Score definitions — data types, ranges, and categories.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    docs: `${DOCS}/score-configs`,
    kind: 'module',
    routes: [{ path: '', component: ScoreConfigsModule }],
  },
  {
    // Native — human-review queues on the REAL /v1/o11y/reviews surface.
    // Read-only list; honest RuntimeNotice when the runtime is not initialized.
    id: 'annotation-queues',
    label: 'Annotation Queues',
    icon: ClipboardList,
    description: 'Review queues for scoring traces and observations.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    docs: `${DOCS}/annotation-queues`,
    kind: 'module',
    routes: [
      { path: '', component: AnnotationQueuesModule },
      { path: ':id', component: AnnotationQueuesModule },
    ],
  },
  {
    // Observations — spans / generations / events inside traces. Was accidentally
    // trapped in this file's opening JSDoc (the `/**` never closed before it), so it
    // never registered despite `ObservationsModule` existing + fetching real data.
    id: 'observations',
    label: 'Observations',
    icon: Activity,
    description: 'Spans, generations, and events inside traces.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    kind: 'module',
    routes: [{ path: '', component: ObservationsModule }],
  },
  {
    // Per-user analytics — same JSDoc-trap fix as Observations; `UsersModule` exists.
    id: 'users',
    label: 'Users',
    icon: Users,
    description: 'Per-user analytics — trace volume, tokens, and cost.',
    category: 'Observe',
    status: 'enabled',
    repo: 'hanzoai/o11y',
    kind: 'module',
    routes: [{ path: '', component: UsersModule }],
  },
  // ── Appended modules (grouped by `category`, not array position — no entry
  //    above is reordered). Memory + Tasks unify the user's memory and durable
  //    work into the one console, on real /v1 backends with honest states.
  {
    // The user's personal memory — what they've asked the assistant to remember.
    // Per-user, on the /v1/memory backend (hanzoai/ai). `enabled`: the module
    // renders now and shows an honest "initializing" card until the backend is
    // deployed — never fabricated memories.
    id: 'memory',
    label: 'Memory',
    icon: NotebookPen,
    description: 'Your personal memory — searchable, editable, in one place.',
    category: 'Data',
    status: 'enabled',
    repo: 'hanzoai/ai',
    docs: `${DOCS}/memory`,
    kind: 'module',
    routes: [
      { path: '', component: MemoryModule },
      { path: ':id', component: MemoryModule },
    ],
  },
  {
    // Durable workflows + schedules — the user's tasks across all their work.
    // REAL /v1/tasks engine (hanzoai/tasks), org-scoped server-side. The
    // canonical home is the Async category (Tasks/Temporal); maps to GCP Cloud
    // Tasks/Workflows.
    id: 'tasks',
    label: 'Tasks',
    icon: Workflow,
    description: 'Durable workflows and schedules — every running and finished task.',
    gcp: 'Cloud Tasks',
    category: 'Compute',
    status: 'enabled',
    repo: 'hanzoai/tasks',
    docs: `${DOCS}/tasks`,
    kind: 'module',
    // The module renders its Workflows/Schedules/Queues/Workers tabs as REAL
    // single-segment sub-routes (`/tasks/:tab`); the two-segment `:ns/:wid` route is
    // the workflow detail. Both are unambiguous (matched by exact segment count).
    routes: [
      { path: '', component: TasksModule },
      { path: ':tab', component: TasksModule },
      { path: ':ns/:wid', component: TasksModule },
    ],
    indexLabel: 'Workflows',
    subpages: [
      { slug: 'schedules', label: 'Schedules' },
      { slug: 'queues', label: 'Queues' },
      { slug: 'workers', label: 'Workers' },
      { slug: 'activities', label: 'Activities' },
    ],
  },

  // ── Settings — org & account administration. Team (members + roles), org
  //    Settings (name/defaults/branding), and the per-user Profile. Member
  //    management runs over the org-scoped `/org/iam` proxy so an ORG admin can
  //    manage their OWN org (not only a global admin), tenant-isolated server-side.
  {
    id: 'team',
    label: 'Members',
    icon: Users,
    description: 'Organization members and roles — invite, assign roles, remove.',
    gcp: 'IAM & Admin',
    category: 'Settings',
    status: 'enabled',
    repo: 'hanzoai/iam',
    docs: `${DOCS}/iam`,
    kind: 'module',
    routes: [
      { path: '', component: TeamModule },
      { path: ':tab', component: TeamModule },
    ],
    indexLabel: 'Members',
    subpages: [{ slug: 'roles', label: 'Roles' }],
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: IdCard,
    description: 'Your account — identity, security, and personal API keys.',
    category: 'Settings',
    status: 'enabled',
    repo: 'hanzoai/iam',
    kind: 'module',
    routes: [
      { path: '', component: ProfileModule },
      { path: ':tab', component: ProfileModule },
    ],
    indexLabel: 'Account',
    subpages: [
      { slug: 'security', label: 'Security' },
      { slug: 'keys', label: 'API Keys' },
    ],
  },
]

/** In-console module (router/match) shape — derived from the catalog. */
export type ProductModule = {
  id: string
  label: string
  icon: ProductIcon
  description: string
  routes: ProductRoute[]
}

/**
 * Category landing pages resolve at `/category/<slug>` through the SAME router as
 * products — one `ProductModule` with one `:slug` `ProductRoute`, matched by the
 * same `resolveRoute` and rendered by the same catch-all. It is deliberately NOT a
 * `catalog` entry: a category is a GROUPING of products, not a product, so it
 * never shows up as a card in the nav / home. `CategoryOverview`
 * derives its whole content from the catalog (`visibleCatalogByCategory`).
 */
export const CATEGORY_ROUTE_ID = 'category'
const categoryRouteModule: ProductModule = {
  id: CATEGORY_ROUTE_ID,
  label: 'Category',
  icon: Boxes,
  description: 'Category overview',
  routes: [{ path: ':slug', component: CategoryOverview }],
}

/** The in-console subset, in catalog order, plus the category-landing router. */
export const productModules: ProductModule[] = [
  ...catalog
    .filter((e): e is Extract<CatalogEntry, { kind: 'module' }> => e.kind === 'module')
    .map(({ id, label, icon, description, routes }) => ({ id, label, icon, description, routes })),
  categoryRouteModule,
]

/** Look up any catalog entry by id. */
export const findEntry = (id: string): CatalogEntry | undefined =>
  catalog.find((e) => e.id === id)

/** The catalog grouped by category, in display order, skipping empty groups. */
export const catalogByCategory = (): { category: ProductCategory; entries: CatalogEntry[] }[] =>
  brandCategoryOrder()
    .map((category) => ({ category, entries: catalog.filter((e) => inBrand(e) && e.category === category) }))
    .filter((g) => g.entries.length > 0)

/** An admin-only (global / Hanzo-managed) entry — hidden from a customer's nav. */
export const isAdminEntry = (e: CatalogEntry): boolean => e.admin === true

/**
 * A BETA entry — hidden until the org holds the beta flag (or is a superadmin).
 *
 * Beta is the COMPLEMENT of the launch set, not a per-entry stamp: we are
 * launching with hanzo.chat, hanzo.app and the console, so everything outside
 * `LAUNCH_PRODUCTS` is beta by default and a new catalog entry is hidden the
 * day it lands. `beta: true` still forces the flag on for an entry inside the
 * launch set, which is how a launch surface can ship dark.
 */
export const isBetaEntry = (e: CatalogEntry): boolean => e.beta === true || !isLaunchProduct(e.id)

/**
 * Per-brand category scope — the ONE knob that makes each brand's console show
 * the right surfaces. `hanzo` is the full AI cloud. The sovereign-chain brands
 * (`lux`, `zoo`, `pars`) are **web3 / bootnode admin** consoles: on-chain
 * (Web3), the networks/nodes/peering plane (Network), key + HSM + authz
 * (Security), developer keys/CLI (Dev), and org/account (Settings) — NOT the
 * AI-cloud surfaces (AI, Compute-for-AI, Training, Data, Observe, Apps,
 * Platform). `null` = every category. Adjust a brand by editing one row.
 */
// The pure scope (categoriesForBrand/categoryInBrand/BRAND_CATEGORIES) is
// re-exported above from ./brand-scope. These two wrappers bind it to the
// CURRENT brand (resolved from the request host).

/** Categories the CURRENT brand's console surfaces (all, for hanzo). */
export const brandCategoryOrder = (): ProductCategory[] => categoriesForBrand(config.brand)

/** True when an entry belongs to the CURRENT brand's console — its category is in
 *  the brand's scope AND the entry's own per-brand scope (if any) admits the brand. */
export const inBrand = (e: CatalogEntry): boolean =>
  categoryInBrand(config.brand, e.category) && entryInBrandScope(config.brand, e.brands)

/**
 * The catalog a given user may SEE. A global admin sees everything; a customer
 * (org owner / member) never sees the admin-only surfaces (cross-tenant IAM/KMS,
 * provider + routing config, cluster ops). Access is enforced server-side too —
 * this is the matching nav gate, so a customer never lands on a hostile 403.
 * Also scoped to the current BRAND (lux/zoo = web3/bootnode, hanzo = full).
 */
// Each product face's ROOT module id (billing/marketing/ads/social/sentry) is owned
// by the ONE shell descriptor (`shellFor(shell).rootId`, lib/products/shell.ts) — the
// former `BILLING_CENTER_ID`/`MARKETING_ID`/`ADS_ID`/`SOCIAL_ID` per-mode consts were
// collapsed into it (a name is a value in one namespace, no parallel id constants).

export const visibleCatalog = (
  showAdmin: boolean,
  enabled?: string[] | null,
  // Fails CLOSED on purpose: a caller that has not asked the enablement plane
  // does not show beta surfaces.
  showBeta = false,
): CatalogEntry[] => {
  // Product-shell face (billing / marketing / ads / social / sentry host, or an
  // override): the SAME console image, scoped to ONE product FACE — its root module
  // surfaced alone. Bypass the brand-category + entitlement scope so the face shows on
  // its host regardless (its category may be outside a web3 brand's normal set). ONE
  // branch for EVERY face, driven by the shell descriptor (`shellFor().rootId`) — zero
  // per-mode duplication; it's the same catalog entry the full console defines, alone.
  if (isProductShell(config.shell)) {
    const rootId = shellFor(config.shell).rootId
    const entry = rootId ? catalog.find((e) => e.id === rootId) : undefined
    return entry ? [entry] : []
  }
  // The full console never shows a product-face-scoped entry (`e.shell`) — those
  // belong to their face, not the general nav (e.g. the sentry panels are the o11y
  // surfaces' Sentry twin, shown only on sentry.<brand>). marketing/ads/social carry
  // NO `e.shell` (normal Apps products), so they ALSO show in the full console.
  const byAdmin = filterBeta(showAdmin ? catalog : catalog.filter((e) => !isAdminEntry(e)), showBeta, showAdmin)
    .filter((e) => !e.shell)
    .filter(inBrand)
  // ENTITLEMENT GATE (customer only): out-of-box an org sees ONLY the products it has
  // enabled/paid for (always-on essentials + its `enabled` set). A super admin
  // (`showAdmin`) bypasses; an ungated set (`enabled` null/undefined — the endpoint
  // hasn't landed) shows everything (no regression). ONE predicate, `filterEntitled`.
  return filterEntitled(byAdmin, enabled, showAdmin)
}

/** `catalogByCategory` scoped to what the user may see (admin surfaces + entitlements gated). */
export const visibleCatalogByCategory = (
  showAdmin: boolean,
  enabled?: string[] | null,
  showBeta = false,
): { category: ProductCategory; entries: CatalogEntry[] }[] => {
  const visible = visibleCatalog(showAdmin, enabled, showBeta)
  // In a product-shell face the root module IS the whole catalog — surface it as a
  // single group regardless of the brand's category order (its category may be
  // outside the brand's normal set). ONE branch for EVERY face.
  if (isProductShell(config.shell)) {
    return visible.length ? [{ category: visible[0].category, entries: visible }] : []
  }
  return brandCategoryOrder()
    .map((category) => ({ category, entries: visible.filter((e) => e.category === category) }))
    .filter((g) => g.entries.length > 0)
}
