/**
 * Runtime configuration — ONE console image serves every brand.
 *
 * Tenancy model: a single cloud `/v1` backend (cloud.hanzo.ai) serves ALL orgs,
 * scoping data by the org claim; each brand authenticates against its OWN IAM
 * (hanzo→hanzo.id, lux→lux.id, zoo→zoolabs.id, pars→pars.id — all live), so the
 * cloud backend validates a per-brand issuer + `aud=<brand>-cloud`. The brand is
 * selected at RUNTIME from the request hostname (cloud.hanzo.ai → hanzo,
 * cloud.lux.cloud → lux, cloud.zoo.cloud → zoo). `config` is a brand-aware
 * proxy resolved from `window.location.hostname`, so the /v1 client + IAM SDK are
 * per-host with no other wiring. `NEXT_PUBLIC_*` still OVERRIDES per field.
 *
 * NOTE: hanzo's issuer is `hanzo.id` (NOT iam.hanzo.ai — legacy zone, iss mismatch
 * drops sign-in). zoo's IAM is `zoolabs.id` (NOT zoo.id). client_id is `<org>-cloud`
 * (HIP-0111). The cloud backend must accept all brand issuers/auds (multi-brand).
 * cloudUrl/platformUrl are shared; billingUrl is PER BRAND (each brand's own
 * billing host, resolved like iamUrl) so a brand's console links to ITS billing
 * portal, scoped to ITS org by the brand JWT. No secrets.
 *
 * NOTE (white-label tenants without their own IAM issuer): `7stars` (7stars.dev)
 * and `yotoda` (yotoda.tech) are general Hanzo-cloud customers seeded AS ORGS IN
 * the hanzo IAM (`hanzo.id`) — there is NO separate `7stars.id`/`yotoda.id` issuer.
 * So their `iamUrl` is `https://hanzo.id` (the issuer that actually holds the org),
 * with the per-brand `iamOrgName` (`7stars`/`yotoda`) + `iamApp` (`7stars-cloud`/
 * `yotoda-cloud`). Login resolves against hanzo.id, org-scoped by the JWT owner —
 * matching how the orgs/apps were provisioned. (Contrast lux/zoo/pars, which each
 * DO run their own issuer.)
 */

const trimSlash = (s: string) => s.replace(/\/+$/, '')

export type BrandId = 'hanzo' | 'lux' | 'zoo' | 'pars' | '7stars' | 'yotoda'

/**
 * The product SHELL a host wears — the console FACE, orthogonal to the brand. ONE
 * console image, host-selected, each face the SAME image scoped to one product:
 * `console` = the full cloud console; `billing` = the Billing-Center portal
 * (billing.<brand>); `marketing`/`ads`/`social` = those product faces
 * (marketing./ads./social.<brand>); `sentry` = the Sentry error/log/trace face
 * (sentry.<brand>). A product face only scopes the nav + default route — brand
 * identity (which IAM you log into, the wordmark) is resolved separately by
 * `brandFromHost`, so a face NEVER crosses brands (sentry.lux.cloud is the lux brand).
 */
export type ShellId = 'console' | 'billing' | 'marketing' | 'ads' | 'social' | 'sentry' | 'dns' | 'platform' | 'tracker'

export type ConsoleConfig = {
  /** Resolved brand id (from hostname). */
  brand: BrandId
  /** Wordmark shown in the shell, e.g. "Lux Cloud". */
  brandName: string
  /** Unified cloud backend base URL (hanzoai/cloud /v1) — shared across brands. */
  cloudUrl: string
  /** PaaS base URL (DOKS cluster control plane) — shared. */
  platformUrl: string
  /**
   * OSS one-click template catalog URL — where the home "Deploy OSS" tile opens the
   * open-source app catalog (Postgres/n8n/Grafana/Supabase/…). Shared; defaults to the
   * PaaS templates surface, env-overridable via NEXT_PUBLIC_TEMPLATES_URL.
   */
  templatesUrl: string
  /**
   * OSS App Store catalog base — the CDN that serves the 1000+ one-click open-source
   * app catalog (`<base>/meta.json`) and per-app blueprints (`<base>/blueprints/<id>/`).
   * The App Store product fetches this DIRECTLY from the browser (open CORS), so it works
   * in the go:embed console with no BFF. Env-overridable via NEXT_PUBLIC_OSS_CATALOG_URL.
   */
  ossCatalogUrl: string
  /**
   * hanzo.app builder base URL — where the Templates gallery's "Open in builder"
   * deep-links (fork a starter → customize by prompt in the builder). Shared,
   * env-overridable via NEXT_PUBLIC_APP_URL; default https://hanzo.app.
   */
  appUrl: string
  /**
   * hanzo.chat base URL — where a project's "Chat about it" deep-links (opens a
   * project-scoped chat via `?project=<iamProjectId>`). Shared, env-overridable via
   * NEXT_PUBLIC_CHAT_URL; default https://hanzo.chat.
   */
  chatUrl: string
  /** Canonical IAM OIDC issuer (the cloud /v1 validates) — shared. */
  iamUrl: string
  /** IAM application name (aud=hanzo-cloud) — shared. */
  iamAppName: string
  /** IAM organization name — PER BRAND (hanzo/lux/zoo). The only auth difference. */
  iamOrgName: string
  /** IAM OAuth client id (= app) — shared. */
  iamClientId: string
  /** Billing/account portal — PER BRAND. The console LINKS here, never reimplements it. */
  billingUrl: string
  /**
   * Hosted top-up/payment page (pay.<brand>) — PER BRAND. The Wallet "Top up" LINKS
   * here (new tab); the console NEVER hosts a card form or mints credit itself.
   * Derived from the brand billing host (billing.<brand> → pay.<brand>), so it is
   * white-label-safe (a Lux console links to pay.lux.cloud, never pay.hanzo.ai).
   */
  payUrl: string
  /** Documentation site — PER BRAND. The console LINKS here (new tab), never embeds it. */
  docsUrl: string
  /** Status page (Gatus) — PER BRAND. The global status badge reads its summary via the /system-status BFF. */
  statusUrl: string
  /**
   * Billing-only shell mode — TRUE on a brand's dedicated billing host
   * (billing.<brand-domain>, e.g. billing.hanzo.ai) or with NEXT_PUBLIC_BILLING_ONLY=1.
   * The SAME console image serves it; the shell just filters the nav to the Billing
   * Center and defaults the route to the billing overview, so people who only ever
   * see billing.hanzo.ai get a full, chromed billing portal — 1:1 with the Billing
   * section inside the full console (zero duplication, same components).
   */
  billingOnly: boolean
  /**
   * Marketing-only shell mode — the legacy `shell === 'marketing'` alias, TRUE on a
   * brand's dedicated marketing host (marketing.<brand>) or NEXT_PUBLIC_MARKETING_ONLY=1.
   * The SAME console image serves it; the shell filters the catalog to the ONE Marketing
   * product and defaults the home route to it (the `/v1/marketing` domain seam). Prefer `shell`.
   */
  marketingOnly: boolean
  /** Ads-only shell mode — the legacy `shell === 'ads'` alias (ads.<brand> / NEXT_PUBLIC_ADS_ONLY=1; the `/v1/ads` seam). Prefer `shell`. */
  adsOnly: boolean
  /** Social-only shell mode — the legacy `shell === 'social'` alias (social.<brand> / NEXT_PUBLIC_SOCIAL_ONLY=1; the `/v1/social` seam). Prefer `shell`. */
  socialOnly: boolean
  /**
   * The product shell this host wears (`shellFromHost`) — the ONE source of the console
   * FACE (console / billing / marketing / ads / social / sentry). Each product face is
   * the SAME image scoped to one product; brand identity is orthogonal (`brandFromHost`),
   * so a face NEVER crosses a brand. `billingOnly`/`marketingOnly`/`adsOnly`/`socialOnly`
   * are legacy `shell === '<x>'` aliases kept for existing call sites; new code reads `shell`.
   */
  shell: ShellId
}

/**
 * THE API host. Every `/v1` call in this app resolves against this one string —
 * there is no second endpoint and no per-brand API host (a brand differs by its
 * IAM issuer and its wordmark, never by where its data lives; the cloud backend is
 * ONE multi-tenant `/v1`, scoped by the brand JWT's org).
 *
 * It is absolute, not `window.location.origin`. Same-origin *looked* compliant only
 * because console.hanzo.ai and api.hanzo.ai are the same binary on the same address
 * — an accident of topology, not a property of the code. Naming the host makes the
 * contract true by construction: relocate the SPA to any origin and it still calls
 * the canonical API.
 */
export const CANONICAL_API_URL = 'https://api.hanzo.ai'

/** Fields shared by every brand. Env-overridable per-deploy. */
const PLATFORM_URL = trimSlash(process.env.NEXT_PUBLIC_PLATFORM_URL ?? 'https://platform.hanzo.ai')
const SHARED = {
  platformUrl: PLATFORM_URL,
  // The OSS one-click template catalog the "Deploy OSS" home tile opens. Defaults to the
  // PaaS deploy flow's templates surface; repoint NEXT_PUBLIC_TEMPLATES_URL at
  // templates.<brand> once that standalone catalog UI is stood up.
  templatesUrl: trimSlash(process.env.NEXT_PUBLIC_TEMPLATES_URL ?? `${PLATFORM_URL}/templates`),
  // The OSS App Store catalog — the live 1000+-app one-click catalog.
  //
  // THE ONE ENDPOINT THIS APP STILL READS THAT IS NOT api.hanzo.ai. It is a live
  // cross-origin data API (measured: GET templates.hanzo.ai/meta.json -> 200 499520B
  // application/json) reachable only because it answers `Access-Control-Allow-Origin: *`
  // — which is precisely why it never announced itself as a problem: no gate, rate
  // limit or audit on api.hanzo.ai has ever seen this traffic.
  //
  // Moving it needs a cloud-side `/v1/oss/*` head first (measured today: 404). It is a
  // THREE-file surface, not one endpoint (`@hanzo/ui/oss`) — `<base>/meta.json` is the
  // catalog, `<base>/blueprints/<id>/<logo>` the icons, `<base>/blueprints/<id>/
  // docker-compose.yml` the deploy blueprint — so the base moves as a unit and cloud
  // must serve the whole prefix. Repointing this line before that head exists would
  // simply break the App Store, so the line stays honest until it can move.
  //
  // NB: the destination is NOT `/v1/templates`. That head already exists and is a
  // DIFFERENT catalog — Hanzo project starters (`{data:[{slug:"synapse",…}]}`, 34948B)
  // versus self-hostable OSS apps (`[{id:"2fauth",…}]`, 499520B). Folding one onto the
  // other would collide two unrelated catalogs on one name.
  ossCatalogUrl: trimSlash(process.env.NEXT_PUBLIC_OSS_CATALOG_URL ?? 'https://templates.hanzo.ai'),
  appUrl: trimSlash(process.env.NEXT_PUBLIC_APP_URL ?? 'https://hanzo.app'),
  chatUrl: trimSlash(process.env.NEXT_PUBLIC_CHAT_URL ?? 'https://hanzo.chat'),
}

/**
 * Cloud `/v1` base — `CANONICAL_API_URL`, or `NEXT_PUBLIC_CLOUD_URL` when a
 * deployment must point elsewhere (local dev against `next dev`, where the Node BFF
 * and the `next.config.mjs` rewrites are the terminus; or a self-hosted cloud).
 * That override is BUILD-TIME deploy config — never user input. The user-addable
 * network `apiEndpoint` (localStorage, see lib/network.ts) is a DIFFERENT and
 * deliberately weaker knob: it retargets chain/data reads only, never `originV1Url`.
 */
function cloudUrl(): string {
  const env = process.env.NEXT_PUBLIC_CLOUD_URL
  return env ? trimSlash(env) : CANONICAL_API_URL
}

/**
 * Per-brand IAM (each org's own issuer/app) + wordmark + billing host. Cloud
 * backend is shared (one multi-tenant /v1, scoped by the brand JWT's org); IAM
 * and billingUrl are the per-brand surfaces. Each brand's billing host runs the
 * same multi-brand billing SPA, scoped to the brand's org via the brand JWT.
 */
// `adminApp` is the OAuth client used on a brand's admin console host
// (admin.<brand>). It targets an app whose IAM organization is the reserved
// `admin` org, so login resolves the global-admin identity (owner=admin) — the
// keystone of the admin.hanzo.ai cutover. The reserved admin org is ONE global
// org, so there is ONE admin login app (`admin-console`); enabling a new brand's
// admin host = add its /auth/callback to that app's redirectUris. Non-admin
// hosts keep the brand's normal `iamApp`.
//
// The reserved global-admin ORG. It is ONE org across every brand (ONE
// `admin-console` app is registered in it), so an admin host authenticates INTO
// this org — not the brand's own — which is why `resolveConfig` switches BOTH the
// app and the org on an admin host. Literal is IAM_ADMIN_ORG=admin.
const ADMIN_ORG = 'admin'
// DEPRECATED — DATA-DRIVEN MIGRATION (white-label follow-up). This hardcoded
// BRANDS + HOST_BRANDS map is the "add a brand = edit code + redeploy" hardcode the
// white-label system removes. The canonical source of a brand is the TENANT RECORD
// (organization + webServerSettings.{host,logoUrl,faviconUrl} + domain bindings),
// resolved at RUNTIME by host via GET /v1/brand?host=. New brands = a tenant record
// (the Tenants board creates it), NOT a row here. NOT swapped yet: NEXT_PUBLIC_IAM_*
// + the OAuth issuer bake in at build time, so a blind swap breaks sign-in. Treat
// these rows as the SEED for the tenant records until every host has one, then delete.
const BRANDS: Record<BrandId, { brandName: string; iamUrl: string; iamOrgName: string; iamApp: string; adminApp: string; billingUrl: string; docsUrl: string; statusUrl: string }> = {
  hanzo: { brandName: 'Hanzo Cloud', iamUrl: 'https://hanzo.id', iamOrgName: 'hanzo', iamApp: 'hanzo-cloud', adminApp: 'admin-console', billingUrl: 'https://billing.hanzo.ai', docsUrl: 'https://docs.hanzo.ai', statusUrl: 'https://status.hanzo.ai' },
  lux: { brandName: 'Lux Cloud', iamUrl: 'https://lux.id', iamOrgName: 'lux', iamApp: 'lux-cloud', adminApp: 'admin-console', billingUrl: 'https://billing.lux.cloud', docsUrl: 'https://docs.lux.network', statusUrl: 'https://status.lux.network' },
  zoo: { brandName: 'Zoo Cloud', iamUrl: 'https://zoolabs.id', iamOrgName: 'zoo', iamApp: 'zoo-cloud', adminApp: 'admin-console', billingUrl: 'https://billing.zoo.cloud', docsUrl: 'https://docs.zoo.ngo', statusUrl: 'https://status.zoo.ngo' },
  pars: { brandName: 'Pars Cloud', iamUrl: 'https://pars.id', iamOrgName: 'pars', iamApp: 'pars-cloud', adminApp: 'admin-console', billingUrl: 'https://billing.pars.cloud', docsUrl: 'https://docs.pars.network', statusUrl: 'https://status.pars.network' },
  // White-label cloud tenants seeded as orgs IN the hanzo IAM (hanzo.id) — no own
  // .id issuer, so iamUrl = https://hanzo.id with the per-brand org/app (see NOTE above).
  '7stars': { brandName: '7Stars Cloud', iamUrl: 'https://hanzo.id', iamOrgName: '7stars', iamApp: '7stars-cloud', adminApp: 'admin-console', billingUrl: 'https://billing.7stars.dev', docsUrl: 'https://docs.7stars.dev', statusUrl: 'https://status.7stars.dev' },
  yotoda: { brandName: 'Yotoda Cloud', iamUrl: 'https://hanzo.id', iamOrgName: 'yotoda', iamApp: 'yotoda-cloud', adminApp: 'admin-console', billingUrl: 'https://billing.yotoda.tech', docsUrl: 'https://docs.yotoda.tech', statusUrl: 'https://status.yotoda.tech' },
}

/** Hostname suffix → brand. First match wins. */
const HOST_BRANDS: ReadonlyArray<{ suffix: string; brand: BrandId }> = [
  { suffix: 'hanzo.ai', brand: 'hanzo' },
  { suffix: 'lux.cloud', brand: 'lux' },
  { suffix: 'lux.network', brand: 'lux' },
  { suffix: 'lux.id', brand: 'lux' },
  { suffix: 'zoo.cloud', brand: 'zoo' },
  { suffix: 'zoo.ngo', brand: 'zoo' },
  { suffix: 'zoo.network', brand: 'zoo' },
  { suffix: 'zoolabs.id', brand: 'zoo' },
  { suffix: 'hanzo.id', brand: 'hanzo' },
  { suffix: 'pars.cloud', brand: 'pars' },
  { suffix: 'pars.network', brand: 'pars' },
  // White-label cloud tenants. One suffix each covers every subdomain
  // (cloud.7stars.dev, console.7stars.dev, …) via the `endsWith('.'+suffix)` match.
  { suffix: '7stars.dev', brand: '7stars' },
  { suffix: 'yotoda.tech', brand: 'yotoda' },
]

/** Resolve the brand id from a hostname (port/case/trailing-dot-insensitive).
 *  Defaults to hanzo. Normalization goes through the one `normHost` helper so
 *  the suffix match can never be softened by a padded/ported/FQDN-dot host
 *  (a mis-resolve here would swap the admin-gate `adminDomain`). */
export function brandFromHost(host?: string | null): BrandId {
  const hostname = normHost(host)
  if (hostname) {
    for (const e of HOST_BRANDS) {
      if (hostname === e.suffix || hostname.endsWith('.' + e.suffix)) return e.brand
    }
  }
  return 'hanzo'
}

/** Current hostname: window in the browser, NEXT_PUBLIC_DEFAULT_HOST for SSR/build. */
function currentHost(): string {
  if (typeof window !== 'undefined') return window.location.hostname
  return process.env.NEXT_PUBLIC_DEFAULT_HOST ?? 'cloud.hanzo.ai'
}

/** Normalize a host for keying/matching: trim, lowercase, strip trailing port,
 *  strip the FQDN root dot(s). Order is load-bearing — trim BEFORE the port
 *  strip so a padded `"host:port "` still loses its port (the `:\d+$` anchor
 *  would otherwise miss past trailing space); strip the port before the trailing
 *  dot so an FQDN-with-port collapses to the bare host. Mirrors
 *  `@hanzo/brand`'s `normalizeHost` (the fleet's one host normalizer). */
function normHost(host?: string | null): string {
  return (host ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.+$/, '')
}

/**
 * True on a brand admin console host (admin.<brand>, e.g. admin.hanzo.ai). Such
 * hosts authenticate against the admin-org OAuth app (`adminApp`) so login
 * resolves the SuperAdmin identity, whereas every normal host uses `iamApp`.
 */
export function isAdminHost(host?: string | null): boolean {
  return normHost(host).startsWith('admin.')
}

/**
 * THE SuperAdmin predicate — the ONE way, everywhere.
 *
 * SuperAdmin ⟺ the principal's IAM org (its `owner`) IS the reserved admin org.
 * `owner` is the org a principal BELONGS TO (an identity is `<owner>/<name>`), not a
 * role — so this reads "a member of the `admin` org", i.e. platform sudo. It is NOT
 * "admin of your own org" (that is the per-user `isAdmin` bit, org-scoped).
 *
 * This mirrors IAM's canonical `User.IsSuperAdmin() { return user.Owner == conf.AdminOrg }`
 * exactly. IAM's `isSuperAdmin` JWT claim is DERIVED from the same equality, so reading
 * the claim as well would be two signals for one fact — this predicate is the only one.
 */
export function isSuperAdminOwner(owner?: string | null): boolean {
  return (owner ?? '').trim().toLowerCase() === ADMIN_ORG
}

/**
 * The JWT `aud` (RFC 8707 resource) the cloud API accepts for `host`'s brand: the
 * brand's cloud client id (`<brand>-cloud`, HIP-0111 `client_id == app == aud`). It
 * is read straight off the brand's `iamApp` — the ONE source — so it stays correct
 * even on an admin host, where the LOGIN app switches to `admin-console` (org admin)
 * but the RESOURCE a forwarded bearer is presented to is still the brand cloud API.
 *
 * cloud's `SanitizeIdentity` ALWAYS trusts this audience: its BrandAudiences union
 * bakes in every `<brand>-cloud`, un-removable by a `CLOUD_JWT_AUDIENCES` override —
 * whereas an admin-org login app (`admin-console`) is NOT in the allowlist. So a
 * user bearer minted for the reserved admin org (`issue-user-token`, whose default
 * `aud` is the target's OWN app = `admin-console`) is REJECTED by cloud unless we
 * scope it to this resource. The admin-aggregate BFF passes it as the mint audience
 * so the operator's forwarded bearer (owner=admin, isAdmin=true) actually validates.
 */
export function cloudAudience(host?: string | null): string {
  return BRANDS[brandFromHost(host)].iamApp
}

/**
 * The brand's own Hanzo Studio origin (the visual AI engine), or null when this
 * cloud has no provisioned Studio. WHITE-LABEL LAW: a brand without its own
 * instance gets null (an honest not-provisioned state) — NEVER another brand's
 * Studio. This is the ONE gate the Studio embed reads.
 */
const STUDIO_URLS: Partial<Record<BrandId, string>> = { hanzo: 'https://studio.hanzo.ai' }
export function studioUrl(host?: string | null): string | null {
  return STUDIO_URLS[brandFromHost(host)] ?? null
}

/**
 * True on a brand's dedicated billing host (billing.<brand>, e.g. billing.hanzo.ai
 * / billing.lux.cloud / billing.zoo.cloud). Such a host runs the SAME console image
 * but in billing-only shell mode (nav filtered to the Billing Center, default route
 * → billing overview). Strict `billing.` prefix — no false positives.
 */
export function isBillingOnlyHost(host?: string | null): boolean {
  return normHost(host).startsWith('billing.')
}

/**
 * Billing-only mode for a host: the dedicated billing host OR an explicit
 * NEXT_PUBLIC_BILLING_ONLY=1 override (dev / preview). The env is baked at build,
 * the host is resolved at runtime — either turns the shell into a billing portal.
 */
export function isBillingOnly(host?: string | null): boolean {
  return process.env.NEXT_PUBLIC_BILLING_ONLY === '1' || isBillingOnlyHost(host)
}

/**
 * True on a brand's dedicated marketing host (marketing.<brand>, e.g.
 * marketing.hanzo.ai). Such a host wears the SAME console image as the Marketing
 * product face. Strict `marketing.` prefix — the host twin of `isBillingOnlyHost`.
 */
export function isMarketingHost(host?: string | null): boolean {
  return normHost(host).startsWith('marketing.')
}

/**
 * Marketing-only mode for a host: the dedicated marketing host OR an explicit
 * NEXT_PUBLIC_MARKETING_ONLY=1 override (dev / preview). Mirrors isBillingOnly.
 */
export function isMarketing(host?: string | null): boolean {
  return process.env.NEXT_PUBLIC_MARKETING_ONLY === '1' || isMarketingHost(host)
}

/**
 * True on a brand's dedicated ads host (ads.<brand>, e.g. ads.hanzo.ai). Wears the
 * SAME image as the Ads product face. Strict `ads.` prefix — the host twin of
 * `isBillingOnlyHost`.
 */
export function isAdsHost(host?: string | null): boolean {
  return normHost(host).startsWith('ads.')
}

/**
 * Ads-only mode for a host: the dedicated ads host OR an explicit
 * NEXT_PUBLIC_ADS_ONLY=1 override (dev / preview). Mirrors isBillingOnly.
 */
export function isAds(host?: string | null): boolean {
  return process.env.NEXT_PUBLIC_ADS_ONLY === '1' || isAdsHost(host)
}

/**
 * True on a brand's dedicated social host (social.<brand>, e.g. social.hanzo.ai).
 * Wears the SAME image as the Social product face. Strict `social.` prefix — the
 * host twin of `isBillingOnlyHost`.
 */
export function isSocialHost(host?: string | null): boolean {
  return normHost(host).startsWith('social.')
}

/**
 * Social-only mode for a host: the dedicated social host OR an explicit
 * NEXT_PUBLIC_SOCIAL_ONLY=1 override (dev / preview). Mirrors isBillingOnly.
 */
export function isSocial(host?: string | null): boolean {
  return process.env.NEXT_PUBLIC_SOCIAL_ONLY === '1' || isSocialHost(host)
}

/**
 * True on a brand's dedicated Sentry host (sentry.<brand>, e.g. sentry.hanzo.ai) —
 * the SAME console image, wearing the Sentry error/log/trace product face. Strict
 * `sentry.` prefix — no false positives.
 */
export function isSentryHost(host?: string | null): boolean {
  return normHost(host).startsWith('sentry.')
}

/**
 * True on the dedicated DNS host (dns.<brand>, e.g. dns.hanzo.ai) — the SAME console
 * image wearing the DNS-management product face (the DnsModule). Strict `dns.` prefix.
 * dns.hanzo.ai is a DNS-faced alias of console.hanzo.ai (same cloud backend), so it
 * boots straight into the DNS dashboard while console.hanzo.ai keeps it as one product
 * among many — one shared surface, two entry points.
 */
export function isDnsHost(host?: string | null): boolean {
  return normHost(host).startsWith('dns.')
}

/**
 * True on the dedicated PaaS control-plane host (platform.<brand>, e.g.
 * platform.hanzo.ai) — the SAME console image wearing the Platform product face (the
 * embedded PaaS: real apps/deploys/drift + health-gated redeploy over the /paas
 * control plane, the `platform` catalog module). Strict `platform.` prefix.
 * platform.hanzo.ai is a Platform-faced alias of console.hanzo.ai (same cloud backend)
 * that boots straight into the control plane, while console.hanzo.ai keeps Platform as
 * one product among many — one shared surface, two entry points (mirrors dns.<brand>).
 */
export function isPlatformHost(host?: string | null): boolean {
  return normHost(host).startsWith('platform.')
}

/**
 * True on the dedicated Tracker host (tracker.<brand>, e.g. tracker.hanzo.ai) — the
 * SAME console image wearing the standalone Linear-grade issue-tracker face (the
 * TrackerModule: unified issues board across every team + every mirrored GitHub repo,
 * teams, cycles, roadmap, agent-actionable work). Strict `tracker.` prefix — no false
 * positives. tracker.hanzo.ai boots straight into the tracker with the catalog chrome
 * stripped, while console.hanzo.ai keeps Tracker as one product among many — one shared
 * surface (cloud `/v1/tracker`), two entry points.
 */
export function isTrackerHost(host?: string | null): boolean {
  return normHost(host).startsWith('tracker.')
}

/**
 * The product shell a host wears, resolved at runtime — the ONE resolver for EVERY
 * console FACE. `NEXT_PUBLIC_PRODUCT_SHELL` overrides for dev/preview (any host → a
 * chosen face); otherwise each dedicated host (or its legacy `NEXT_PUBLIC_*_ONLY=1`
 * env) selects its face — billing / marketing / ads / social / sentry / dns / platform /
 * tracker —
 * and everything else is the full `console`. Brand is resolved separately
 * (`brandFromHost`), so the shell is orthogonal — a face NEVER crosses a brand
 * (sentry.lux.cloud is the lux brand).
 */
export function shellFromHost(host?: string | null): ShellId {
  const env = process.env.NEXT_PUBLIC_PRODUCT_SHELL
  if (env === 'billing' || env === 'marketing' || env === 'ads' || env === 'social' || env === 'sentry' || env === 'dns' || env === 'platform' || env === 'tracker' || env === 'console') return env
  if (isBillingOnly(host)) return 'billing'
  if (isMarketing(host)) return 'marketing'
  if (isAds(host)) return 'ads'
  if (isSocial(host)) return 'social'
  if (isSentryHost(host)) return 'sentry'
  if (isDnsHost(host)) return 'dns'
  if (isPlatformHost(host)) return 'platform'
  if (isTrackerHost(host)) return 'tracker'
  return 'console'
}

// Cache is keyed by NORMALIZED HOST (not brand): admin.hanzo.ai and
// cloud.hanzo.ai are the same brand but MUST resolve to different clients
// (admin-console vs hanzo-cloud), so a brand-keyed cache would collide.
const cache = new Map<string, ConsoleConfig>()

/** Resolve the full config for the current host. iamOrgName overridable via env. */
export function resolveConfig(host: string = currentHost()): ConsoleConfig {
  const key = normHost(host) || 'default'
  const cached = cache.get(key)
  if (cached) return cached
  const brand = brandFromHost(host)
  const b = BRANDS[brand]
  // On an admin host the login targets the reserved global-admin org's app
  // (`admin-console` @ org `admin`) so IAM mints the global-admin identity
  // (owner=admin); every normal host keeps the brand's own app + org. The app AND
  // the org travel together — both switch on an admin host (iamAppName/iamClientId
  // are the same app). An explicit NEXT_PUBLIC_* override still wins for every
  // field (unchanged precedence).
  const admin = isAdminHost(host)
  const app = admin ? b.adminApp : b.iamApp
  const org = admin ? ADMIN_ORG : b.iamOrgName
  // ONE source for the shell; billingOnly is the legacy `shell === 'billing'` view.
  const shell = shellFromHost(host)
  const resolved: ConsoleConfig = {
    brand,
    brandName: b.brandName,
    cloudUrl: cloudUrl(),
    iamUrl: trimSlash(process.env.NEXT_PUBLIC_IAM_URL ?? b.iamUrl),
    iamOrgName: process.env.NEXT_PUBLIC_IAM_ORG_NAME ?? org,
    iamAppName: process.env.NEXT_PUBLIC_IAM_APP_NAME ?? app,
    iamClientId: process.env.NEXT_PUBLIC_IAM_CLIENT_ID ?? app,
    billingUrl: trimSlash(process.env.NEXT_PUBLIC_BILLING_URL ?? b.billingUrl),
    // pay.<brand> — derived from the brand billing host (billing.<brand> → pay.<brand>),
    // so each brand links to ITS OWN hosted payment page. Env-overridable per-deploy.
    payUrl: trimSlash(process.env.NEXT_PUBLIC_PAY_URL ?? b.billingUrl.replace(/:\/\/billing\./, '://pay.')),
    docsUrl: trimSlash(process.env.NEXT_PUBLIC_DOCS_URL ?? b.docsUrl),
    statusUrl: trimSlash(process.env.NEXT_PUBLIC_STATUS_URL ?? b.statusUrl),
    // ONE source (`shell`); the four *Only booleans are its legacy `shell === '<x>'` aliases.
    billingOnly: shell === 'billing',
    marketingOnly: shell === 'marketing',
    adsOnly: shell === 'ads',
    socialOnly: shell === 'social',
    shell,
    ...SHARED,
  }
  cache.set(key, resolved)
  return resolved
}

/**
 * Brand-aware config. Reading any field resolves the brand from the current
 * hostname, so `config.iamOrgName` / `config.cloudUrl` etc. are correct per host
 * with no consumer changes.
 */
export const config: ConsoleConfig = new Proxy({} as ConsoleConfig, {
  get: (_t, key: string) => resolveConfig()[key as keyof ConsoleConfig],
})

// Shared product-release label. The console app's major.minor IS the umbrella
// "Hanzo Cloud <release>" — one source (package.json → NEXT_PUBLIC_APP_VERSION),
// never hardcoded twice. cloud ships its own Go v1.x build under the same
// umbrella; only this label is unified, not the build versions.
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? ''
const PRODUCT_RELEASE = APP_VERSION.split('.').slice(0, 2).join('.')

/** Brand-aware shell branding. */
export const branding = {
  get name(): string {
    return `${resolveConfig().brandName} Console`
  },
  short: 'Cloud Console',
  /** Full console build version, e.g. "8.4.11". */
  appVersion: APP_VERSION,
  /** Shared product-release, e.g. "8.4" (console major.minor). */
  release: PRODUCT_RELEASE,
  /** Umbrella product-line label, e.g. "Hanzo Cloud 8.4". */
  get productLine(): string {
    return PRODUCT_RELEASE ? `${resolveConfig().brandName} ${PRODUCT_RELEASE}` : resolveConfig().brandName
  },
} as const
