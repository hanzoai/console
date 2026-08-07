# console2 — Hanzo Cloud Console

Unified admin console for **Hanzo Cloud** and all cloud products. Our code,
`MIT OR Apache-2.0` (HIP-0137), built on **@hanzo/gui** (the Tamagui-based cross-platform UI).
NOT an observability-console fork, NOT casibase — it is a clean client over the unified `/v1`
backend (`hanzoai/cloud`), reached at the ONE Hanzo API endpoint https://api.hanzo.ai/v1/*.

## Base: Next.js 15 (app router) + @hanzo/gui

The @hanzo/gui `expo-router` template was evaluated first and **rejected for a
standalone repo**: it declares `workspace:*` dependencies (`hanzogui`,
`@hanzogui/config`, `@hanzogui/babel-plugin`, …) that only resolve inside the gui
bun monorepo — `npm install` of a copy fails with
`EUNSUPPORTEDPROTOCOL "workspace:"`. It is also native-first with no real
typecheck (`"test": "true"`), a poor fit for a data-heavy web admin.

So the base is **Next.js + @hanzo/gui (npm)**. Gui is consumed at **runtime**:
Next's built-in `transpilePackages` transpiles the Gui ESM packages (discovered
from `node_modules/@hanzogui`, not hardcoded) and `GuiProvider` injects CSS at
runtime. Gui is designed to work this way — the optimizing compiler is an
optimization, not a requirement.

The canonical `@hanzogui/next-plugin@7.3.0` is **broken on npm**: it depends on
`hanzogui-loader@7.3.0` (unpublished — only `2.x`/`102.x` fork tags exist), and
that fork renames the export the plugin imports (`GuiPlugin` → `HanzoguiPlugin`).
Pinning the fork via overrides surfaces the rename at build time. So the plugin
is unusable standalone; `transpilePackages` is the clean, supported path.

**v5 config uses `onlyShorthandStyleProps`** — components use Gui shorthand style
props (`p`, `px`, `bg`, `items`, `justify`, `self`, `rounded`, `minH`, …), not
longhands. With shorthands, `tsc --noEmit` (strict) passes clean and the build
type-checks with no suppression.

**Next 15, not 14:** @hanzo/gui requires `react>=19`. Next 14 ships React 18 and
cannot run React 19 (App Router server components are version-locked to the
bundled React). Next 15.5.x is the current stable that natively supports React
19 — so 15 is the correct, non-degrading choice. The task's "Next 14" is
impossible without downgrading Gui or breaking the peer tree.

## Layout

```
app/                         Next.js app router
  layout.tsx                 html shell, dark default, mounts <Provider>
  globals.css                base resets (Gui CSS injected via plugin)
  signin/page.tsx            sign-in (delegates to IAM)
  auth/callback/page.tsx     OIDC callback -> /v1/signin -> session
  (dashboard)/
    layout.tsx               AuthGate + DashboardShell
    page.tsx                 product overview cards
    [...slug]/page.tsx       catch-all: resolves a module+route from the registry
src/
  config/index.ts            single env reader (NEXT_PUBLIC_*), branding
  lib/
    api/                     typed /v1 client (ours)
      client.ts              core request: cookies, envelope unwrap, ApiError
      types.ts               Provider, ModelRoute, Application, Store, Chat, Account
      providers|model-routes|applications|stores|chats|account.ts
      index.ts               barrel
    auth/
      iam.ts                 @hanzo/iam-js-sdk wrapper (browser-only), getSigninUrl
      session.tsx            SessionProvider/useSession (account, signIn, signOut)
    products/
      registry.tsx           ProductModule[] — the extensibility backbone
      match.ts               slug -> {module, route, params}
  components/
    Provider.tsx             GuiProvider + next-theme + SessionProvider (dark)
    DashboardShell.tsx       sidebar (from registry) + topbar (adapts dashboard-shell recipe)
    AuthGate.tsx             gate authenticated routes
    SignInForm.tsx           adapts sign-in-form recipe; IAM redirect
    ui/                      PageHeader, DataTable, Field*
    products/
      ProvidersModule.tsx    FULL surface: list + view/edit
      providers/             logic.ts (pure cascade/visibility), List/Edit views
      ModelsModule.tsx       routes list <-> new/edit
      models/                logic.ts (newModelRoute), ModelRoute List/Edit views
      ApplicationsModule.tsx routes list <-> edit
      applications/          logic.ts (newApplication), List/Edit (deploy/undeploy)
      StoresModule.tsx       routes list <-> edit
      stores/                logic.ts (newStore), List (refresh-vectors)/Edit views
      ChatModule.tsx         routes list <-> read-only chat view
      chat/                  ChatListView + ChatView (message thread)
```

Each product module mirrors Providers: a router module (`<X>Module.tsx`), a
list view + an edit/view, and a pure `logic.ts` (new-record templates / option
lists). Every module declares a `''` (list) and `:name` (edit/view) route in the
registry; Models also handles `:name === 'new'` for create (model routes are
keyed by `owner/modelName`, so modelName is form-entered, not generated).

## /v1 backend client

One `request()` in `lib/api/client.ts`: always `credentials: 'include'` (the
backend sets a session cookie at `/v1/signin`), forwards `Accept-Language`,
unwraps the casibase `{ status, msg, data, total }` envelope (named `total`
first, legacy `data2` count accepted until the emitters finish renaming), throws typed
`ApiError` (401/403 carry status). Base URL = `config.cloudUrl` (default
`https://cloud.hanzo.ai`, override `NEXT_PUBLIC_CLOUD_URL`).

Endpoint surface ported from `hanzoai/ai` `web/src/backend/*.js`
(see `docs/endpoints.md`):
- **ProviderApi** — get-global-providers, get-providers, get-provider,
  add/update/delete-provider, refresh-mcp-tools
- **ModelRouteApi** — get(-model-routes|-route), add/update/delete-model-route
- **ApplicationApi** — get(-applications|-application), add/update/delete,
  deploy/undeploy-application
- **StoreApi** — get-global-stores, get-stores, get-store, get-store-names,
  add/update/delete-store, refresh-store-vectors
- **ChatApi** — get-global-chats, get-chats, get-chat, add/update/delete-chat
- **AccountApi** — get-account, signin, signout

## Auth (Hanzo IAM)

`@hanzo/iam-js-sdk` against **`hanzo.id`** — the canonical OIDC issuer
(`iss=https://hanzo.id`), the one the cloud `/v1` backend validates. `getSigninUrl()`
builds the authorize URL (`https://hanzo.id/login/oauth/authorize?...redirect_uri=
<origin>/auth/callback`). IAM returns `?code&state`; the callback posts them to
`/v1/signin`, which the cloud backend exchanges and mints the session cookie;
`useSession` then loads `/v1/get-account`.

App/client is **`hanzo-cloud`**, org `hanzo` — NOT a console-specific app. console2
is a front-end OF the shared cloud `/v1` backend, which exchanges the code and
validates the token as app `hanzo-cloud` (`aud=hanzo-cloud`), so the browser MUST
present the same `client_id`. (The `hanzo-cloud` IAM app already whitelists
`https://console2.hanzo.ai/auth/callback`.)

**Build-time gotcha (the 2026-06 sign-in bug):** every `NEXT_PUBLIC_IAM_*` is
inlined at BUILD time (browser config), so the *image* — not runtime env — decides
the issuer. The mainnet image MUST bake `NEXT_PUBLIC_IAM_URL=https://hanzo.id`.
Baking `iam.hanzo.ai` (the legacy zone, `iss=https://iam.hanzo.ai`) dropped the user
on iam.hanzo.ai with an issuer mismatch. Fixed in `src/config/index.ts` (default),
`.env.example`, the `Dockerfile` ARG default, and the mainnet `iam_url` build-arg in
`.github/workflows/build-image.yml`.

## Product-module registry (extensibility)

`lib/products/registry.tsx` is the single source of nav + routing truth. Each
cloud product is a `ProductModule { id, label, icon, description, routes }`. The
sidebar, overview, and the catch-all route all render from it. **Adding a cloud
product = appending one entry + its module component(s); no shell or route
edits.** A module owns its routes and components and knows nothing about
siblings (orthogonal).

## Dev

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_IAM_CLIENT_ID for live auth
npm run typecheck            # tsc --noEmit (strict) — clean
npm run build                # next build (type-checks; Gui CSS injected at runtime)
npm run dev                  # http://localhost:4000
```

Data layer is the unified `/v1` backend — this repo is frontend only. Do NOT
add Postgres/Mongo/etc. Do NOT build Docker images locally (CI/CD does that).

## Cloud console — 10-category CLOUD AXIS + embedded PaaS (feat/cloud-taxonomy-10cat)

The catalog (`src/lib/products/registry.tsx`) is reorganized from 6 ad-hoc
categories to the canonical **10-category cloud axis** (the same taxonomy as the
hanzo.ai product surface, `/tmp/hanzo-cloud-taxonomy.md`), so console2 reads like
a cloud console (GCP/AWS) — resources grouped by cloud primitive, two rows of
five:

```
AI        Compute     Data        Network     Security
Dev       Deploy      Observe     Chain       Apps
```

**Three entry kinds, zero dead links, zero fakes** (`CatalogEntry.kind` +
`status`):
- `module`  — in-console admin surface (Providers/Models/Chat/Stores=Vector/
  Applications, + the embedded PaaS).
- `external`— a REAL Hanzo product on its own domain (Inference→api.hanzo.ai,
  Search→search.hanzo.ai, Bot→hanzo.bot, IAM→iam, KMS→kms, Observe/Traces/
  Dashboards→console.hanzo.ai, Analytics, Cost→billing, Object Storage→s3,
  Edge, Flow, Sign, Crawl, Studio).
- `soon`    — a real cloud primitive without a UI yet (GPUs, VPC, HSM, Settlement,
  …). Renders an HONEST in-console "coming soon" overview (`ComingSoon.tsx`,
  resolved by id from the path) that points at the API/CLI — **never a 404 and
  never a fabricated product card**. A `soon` entry is a `module` under the hood
  (single route → `ComingSoon`), so routing is unchanged.

The nav shell, catalog home, favorites, and router still render from the one
`catalog` list. `status: 'soon'` shows a "Coming soon" badge + affordance.

### Job 3 — PaaS embedded natively under Deploy (NOT an iframe)

`PlatformModule.tsx` is the embedded PaaS, wired to the REAL PaaS control plane.
The browser calls console2's OWN origin under `/paas/*`; the server route
`app/paas/[...path]/route.ts` forwards to the ONE Hanzo API endpoint at
`/v1/paas/*` (`CLOUD_API_URL`, default `https://api.hanzo.ai` — in-cluster in
prod), never a second API host: `platform.hanzo.ai` serves no `/v1/paas/*` route
and 401s every `/v1/*` path uniformly.
It carries the service token from **server-only** env `PAAS_SERVICE_TOKEN` (sourced via
KMS — never `NEXT_PUBLIC_`, never in the browser bundle, no CORS). It lists real
apps across clusters with **declared vs running tag + drift** and a real
health-gated **redeploy** (`POST /v1/apps/<id>/redeploy`). The six Deploy
sub-pages (Projects/Environments/Builds/Registry/Releases/Pipelines) are tabs
over the same real inventory. States are honest: loading, **not-configured (501
when `PAAS_SERVICE_TOKEN` is unset)**, error, empty — it never invents rows.
To light up real data in prod: add `PAAS_SERVICE_TOKEN` (+ optional
`PLATFORM_URL`) to the console2 deployment env via a KMSSecret.

### Job 4 — no fake/placeholder/stub data

The catalog is honest by construction (every leaf → real module, real product
domain, or honest `soon` overview). The PaaS embed shows only real control-plane
data with honest empty/not-configured states. No lorem stats, no demo projects,
no placeholder cards.

Build: arcd self-hosted CI (`.github/workflows/build-image.yml`, push to `main` →
`ghcr.io/hanzoai/console:v<package.json version>`, SEMVER only). The
`hanzo-build-linux-amd64` ARC runner pool is the builder (online; not GHA-hosted).

Deploy: console IS an operator `Service` CR now (`hanzo.ai/v1`, `hsvc console`,
ns `hanzo`) — declared in `universe/infra/k8s/operator/crs/console2-v1.yaml`.
Bump `spec.image.tag`, `kubectl apply`, the operator reconciles. Verify live with
headless Playwright on console2.hanzo.ai.

## Live E2E product-bug fixes (v8.4.54)

Five "advertised-but-broken" surfaces the live E2E suite flagged, fixed honestly
in the client (no fabrication):

- **Vector module rendered nothing.** `GET /v1/vector` 200'd but the module
  blanked while SQL/KV rendered — the vector provisioning backend 200s a WRAPPED
  body (not a bare `Resource[]`), so the list view's `for…of` threw during render
  behind the error boundary. Fix: `normalizeResourceList` in `lib/api/provisioning.ts`
  validates + unwraps the list at the TRANSPORT boundary (bare array, or a
  `{data|items|results|resources|collections|list|rows}` wrapper incl. one level of
  nesting like Qdrant `result.collections`), honest `[]` fallback — ONE place, every
  kind. Don't add per-kind unwrap in the view.
- **`/chat` reply now STREAMS.** The composer already POSTed a working completion;
  it now renders token-by-token via `AiApi.ragChatStream` (grounded RAG headers ride
  `PlaygroundApi.streamChat`). The SSE parser's canonical home moved to
  `lib/api/stream.ts` (ONE definition, re-exported from `playground/stream.ts`);
  the error card's Retry now re-runs the last user turn (was a no-op — input is
  cleared on send).
- **Functions list self-freshens.** `useReloadOnFocus` (`lib/use-reload-on-focus.ts`,
  pure `armReloadOnFocus` core + tests) refetches on window focus / tab-visible, so
  an API/CLI-deployed function appears without a manual reload; plus a header Refresh.
- **Sign-out redirects deterministically.** `session.tsx` `signOut` now hard-navigates
  to `/signin` after `DELETE /auth/session` (AuthGate's reactive redirect could be
  pre-empted by an in-flight session re-hydrate, stranding the user on `/`).
- **CRM summary rollup lag = BACKEND.** The console already refetches
  `/v1/crm/summary` after every create/delete (`onChanged → loadSummary`). The +1 lag
  is the cloud-api materialized rollup (eventual consistency); flagged for the backend
  — NOT faked client-side (no optimistic increment).

## Live verification + backend wiring (v0.1.8)

> v0.1.7 was a parallel CTO branch (`fix/paas-live-data`) that wired only
> Clusters/Kubernetes/Status to the platform `/v1` surface; it is integrated here
> (`-s ours`) and superseded — v0.1.8 is the cumulative release with the full set
> below.

Every embedded module was Playwright-verified live against the real `/v1` backend
(authenticated hanzo-org admin). The backend topology console2 actually talks to:
the same-origin `/v1` ingress routes to **cloud-api** directly (NOT the full
api.hanzo.ai gateway), and `/paas/*` is console2's own server route → platform.

Findings + fixes (all in console2; honest states everywhere, no fakes):
- **X-Org-Id (the big one).** The provisioning sub-service (vector/sql/kv/s3/
  datastore/docdb/search) requires an `X-Org-Id` header and 403s `"X-Org-Id
  required"` without it — cloud-api on the direct path does NOT inject it from the
  session. Fix: `lib/api/client.ts` now stamps `X-Org-Id: config.iamOrgName`
  (brand org, the user's own) on every cloud call (`baseHeaders`). All 7 data
  modules now return real data / honest empty `[]`.
- **PaaS token was wrong.** The CR wired `PAAS_SERVICE_TOKEN` to
  `hanzo-paas/MASTERTOKEN` (`hanzo-master-token`), which platform.hanzo.ai
  **rejects (401)**. The correct token is in secret **`paas-console-token`** key
  `PAAS_SERVICE_TOKEN` (== `platform-service-token`). CR repointed there.
- **Platform contract was wrong.** The real platform serves `GET /v1/apps` (the
  apps inventory: declared/running/latest tag + drift + health + cluster +
  namespace, ~100 services) and `GET|POST /v1/org/{org}/cluster` — NOT
  `/v1/clusters` and NOT any `/k8s/{kind}` passthrough (those 401/404). `lib/api/
  platform.ts` reworked to `PlatformApi.apps()` + org-scoped `listClusters`/
  `provisionCluster`; dead `KubernetesApi`/`CLUSTER_ROUTES` removed.
  - **Status** now reads `/v1/apps` → REAL health board (Services/Healthy/Clusters).
  - **Kubernetes** now reads `/v1/apps` → REAL workloads per cluster (picker from
    the clusters that actually appear).
  - **Clusters** lists real dedicated DOKS via `/v1/org/{org}/cluster` (honest
    empty; provision form wired to the real endpoint). Attach-by-kubeconfig dropped
    (no backend).
  - `interpretPlatformError` maps upstream 401/403 → honest "not configured".
- **Bot** `/v1/bot/health` 404s on cloud-api (bot-gateway runs behind
  api.hanzo.ai/hanzo.bot, not this host) → honest "not routed on this host" state
  (was a red error).
- **Wallet** cloud-credit `/v1/billing/balance` 404s here (billing ships
  separately) → honest "not available on this deployment" (was a scary error).
  HUSD balance/top-up already honest "coming" (token unconfigured).
- **Providers was broken** — `ProviderListView`/`ProviderEditView` imported the
  ZAP twin (`~/lib/zap`), and at the time the cloud `/zap` WS face was not served
  (the edge returned SPA HTML, 200 rather than a WS upgrade), so the module showed
  "Failed to load providers". Switched both back to the working REST `~/lib/api`
  (identical surface). Providers now shows real/empty over REST like every module.

  **STALE AS OF 2026-07-28 — `/zap` IS served.** Measured on all three hosts
  (api.hanzo.ai, platform.hanzo.ai, cloud.hanzo.ai): a WebSocket upgrade handshake
  returns **401**, not SPA HTML and not 200. A route that refuses an
  unauthenticated upgrade is a route that exists. The reason this section gives
  for preferring REST no longer holds, and read as current it says ZAP is
  unavailable when it is merely gated. The REST path is still correct and still
  shipping — this is a stale rationale, not a bug. Re-measure before acting on it.
- Already-correct honest states (unchanged): IAM/Audit + KMS/Secrets (`/v1/iam`,
  `/v1/kms` 404 → "not available on this deployment"); Observability (`/v1/o11y`
  503 → "runtime not initialized"). Plans/Embeddings show real data; Models/
  Providers/Applications/Chat honest-empty.

`StatusTag` now also understands platform health verdicts (green/yellow/red).

## Working AI + API keys + chrome polish (v0.6.0)

The investor-demo wave. ROOT CAUSE of "chats/playground don't work": the gateway
chat endpoints REQUIRE `Authorization: Bearer` — a session cookie alone is
rejected ("Invalid API key format"). The browser sent cookie-only, so every AI
call (chat, playground, cmd+K `>`/`?`) failed. Fixed with two server routes that
keep all credentials server-side (the browser only ever sends its session cookie):

- **`app/ai/[...path]/route.ts`** — keyless AI proxy. Resolves the user from the
  session cookie (cloud `/v1/get-account`), mints a SHORT-LIVED user-bound IAM
  token (`/v1/iam/issue-user-token`, cached per-user until ~60s pre-expiry) as the
  confidential `hanzo-console` client, and forwards to `AI_GATEWAY_URL/v1/<path>`
  with `Bearer <token>`. Allow-listed to `v1/models|chat|chat/completions|
  embeddings|rerank` (not a general tunnel). `playground.ts` now points at this
  proxy (`<origin>/ai`), so Models/Playground/Chat/cmd+K all work with no key in
  the browser and no rotation on a chat turn.
- **`app/keys/route.ts`** — per-user `sk-` Cloud API key. POST mint/rotate, DELETE
  revoke, GET status (no secret). Same app-on-behalf pattern via
  `/v1/iam/mint-user-keys` + `/v1/iam/revoke-user-keys`. The `sk-` secret is shown
  ONCE (POST). `ApiKeysModule` is now create/copy/rotate/revoke.
- Shared trust boundary: `src/lib/server/identity.ts` (server-only) — `resolveUser`
  + `mintUserKey`/`revokeUserKey`/`issueUserToken`. The `hanzo-console` client is
  allow-listed in IAM `IAM_KEY_MINT_ALLOWED_APPS`; verified end-to-end that a
  minted `sk-` key and an issued user JWT both 200 on `api.hanzo.ai/v1/chat/
  completions`.
- **Chat is interactive** (`chat/ChatConversation.tsx`): a real multi-turn
  conversation over `AiApi.chat` (→ the `/ai` proxy), with a Zen default model,
  honest 402 "add credits" state, and a "History" toggle to the old session list.
- **Chrome**: the sidebar/header show the Hanzo **H mark + "Console"**
  (`ui/HanzoMark.tsx` + `ui/BrandLogo.tsx`; `BrandLogo` shows the org's IAM logo
  when set, else the H). The original fullscreen app launcher was later folded into
  the command palette; see v8.5.30 below.

Server-only env the routes need (added to `console2-v1.yaml`, never `NEXT_PUBLIC_`):
`IAM_URL`, `CLOUD_API_URL` (in-cluster cloud-api), `AI_GATEWAY_URL` (api.hanzo.ai),
and `IAM_MINT_CLIENT_ID`/`IAM_MINT_CLIENT_SECRET` from secret `hanzo-console-iam-creds`.

## Admin console live data + org switching (v0.7.0)

The "models empty" + "org switcher broken" wave. ONE root cause: `/v1/iam`,
`/v1/kms`, `/v1/models` 404 (or 401 cookie-only) on the console host, so the
catalog, switcher, IAM, and KMS modules rendered honest-empty. Fix = route every
privileged call through console2's OWN server proxies (which add the user bearer +
the admin gate), and make org scope a first-class, switchable value.

- **Model catalog (the "models missing" bug).** `CloudModelApi.list()` hit cloud
  `/v1/models` with a cookie only → 401 → empty. Repointed at the `/ai` proxy via
  the shared `aiV1Url('models')` (`lib/api/client.ts` now owns `aiBase`/`aiV1Url` —
  ONE place defines the proxy origin; `playground.ts` uses it too). The proxy mints
  a short-lived user token, so the catalog populates with the live Zen models.
  Pricing stays best-effort on the cloud origin (degrades to "—", never fabricated).
- **Org scope is a value, not a place** (`lib/org-scope.ts`). `currentOrg()` /
  `setCurrentOrg()` / `isScopedAway()` / `filterOrgs()`. Default = the brand org;
  a global admin (z@hanzo.ai) can switch to ANY org. Brand identity (host wordmark/
  logo) is orthogonal and unchanged — only the DATA scope moves. `client.ts`
  `baseHeaders` now stamps `X-Org-Id: currentOrg()` (was the fixed brand org), so
  every cloud-data module re-scopes on switch.
- **OrgSwitcher** lists ALL visible orgs (`IamAdminApi.organizations()` via the
  `/admin/iam` proxy → global admin sees every org), adds a **filter** box
  (`filterOrgs`), and **switches in place**: `setCurrentOrg` + reload refetches
  every module under the new `X-Org-Id`. The IAM/KMS proxies authorize a global
  admin for any org and pin a brand admin to their own, so the re-scope is safe.
- **IAM module** (`AdminModule.tsx` `IamModule`/`AuditModule`) reads users/roles/
  records for `currentOrg()` (the org list itself is unscoped — what powers the
  switcher). **KMS module** (`KmsModule.tsx`) was a dead cloud-path probe; now a
  names-only inventory over `KmsAdminApi.list({ org })` (the `/admin/kms` proxy +
  kmsd's metadata-list endpoint, v0.159.4+). Values are NEVER fetched/rendered;
  honest states: loading, operator-access-required (403), listing-unavailable (404),
  empty.
- **Decomplected gate** (`lib/server/admin-policy.ts`, pure, tested). `gateAllows`
  (`@<adminDomain>` email AND IAM admin), `ownerAllowed`, `orgFor` — extracted from
  `getAdminGate` + the IAM/KMS routes so the SAME predicate that ships is the one
  unit-tested. A brand admin can never `orgFor` to another org's KMS (no secret
  leak across orgs).
- **Tests** (vitest, `npm test`): `admin-policy.test.ts` (gate allow/deny + tenant
  scoping), `org-scope.test.ts` (default→switch→reset + filter), `models-catalog.
  test.ts` (catalog fetches `<origin>/ai/v1/models`, never the cookie-only cloud
  path). RED→GREEN, 22 tests. `tsc --noEmit` + `next build` clean.
- The console2 CR already carries the env the proxies need (`IAM_URL`,
  `CLOUD_API_URL`, `AI_GATEWAY_URL`, `IAM_MINT_CLIENT_*`); `KMS_URL` defaults to
  `http://kms.hanzo.svc`. `admin.hanzo.ai` added to the CR ingress hosts.

## First-run org onboarding + waitlists (v0.7.8)

This release is based on the live GitHub `main` at `88d4c68` (v0.7.7), including
the org → project → environment scope model. `Projects` remains a single Deploy
module backed by the IAM project endpoints and the top-bar `ScopeSwitcher`; do
not add a duplicate Apps/Projects entry.

- **One instruction source.** `AGENTS.md` and `CLAUDE.md` are symlinks to
  `LLM.md`; keep agent guidance here only so Codex and Claude stay in sync.
- **First-run org onboarding.** `OrgGate` now sends signed-in users with no org
  to `OrgOnboarding` instead of a dead "no organization" state. The same-origin
  `/onboard` route acts as the confidential `hanzo-console` IAM client, creates
  a customer org (or personal org), moves the caller into it as admin, then the
  client re-authenticates so the new session carries the org. Normal privileged
  routes still use `resolveUser()` (org required); onboarding alone uses
  `resolveAuthenticatedUser()` so it can handle the zero-org session safely.
- **Coming-soon waitlists.** `ComingSoon` renders `WaitlistForm`, which posts to
  `/waitlist`. The server route requires a session and forwards to
  `WAITLIST_URL/v1/waitlist/join`; when `WAITLIST_URL` is unset it returns an
  honest 501 and never fabricates a confirmation.
- **Motion primitive.** `FadeIn` plus the single `.hz-fade-up` keyframe in
  `globals.css` is the shared entrance animation. It honors
  `prefers-reduced-motion`.

Server-only env added by this wave: `WAITLIST_URL` for waitlist forwarding. Org
onboarding uses the existing `IAM_URL`, `CLOUD_API_URL`, and
`IAM_MINT_CLIENT_ID`/`IAM_MINT_CLIENT_SECRET` confidential-client wiring.

## CI base image mirror (v0.7.9)

The ARC runner was still blocked by Docker Hub's unauthenticated pull limit while
pre-pulling `node:22-alpine`. `Dockerfile` now uses
`public.ecr.aws/docker/library/node:22-alpine` for all stages, and
`.github/workflows/build-image.yml` pre-pulls the same ECR Public Docker-library
mirror image. This keeps the host-builder cache behavior but removes Docker Hub
from the cold-runner path.

## Console parity audit + remaining feature ports (2026-06-29)

Old `console/web/src/pages/project/[projectId]` still had routes with no
console2 destination: experiments, dashboard/widgets, integrations
(blob-storage, Slack, Mixpanel, Insights), referrals, zero-trust, prompt
detail/create/metrics, dataset items/runs, annotation queue detail/items, and
score analytics. These are now represented in console2 without copying the old
observability-console internals.

- `ConsoleFeatureModule.tsx` is the shared forward-compatible shell: each moved
  surface declares its exact `/v1` endpoint, renders real rows when the endpoint
  exists, and uses `BackendStateCard` for 404/405/503/access/billing. It never
  fabricates rows.
- New catalog entries: `experiments`, `integrations`, `referrals`, and
  `zero-trust`. `dashboards` is now a native module with an external handoff to
  analytics.hanzo.ai instead of external-only. `scores/analytics` is routed as a
  score subpage.
- Expanded existing modules: Prompts now has list/detail/create/metrics routes;
  Datasets has datasets/items/runs; Annotation Queues has queue detail + work
  items. `EvalsApi` and `O11yApi` carry the corresponding typed
  forward-compatible methods.
- Verification for this wave: `npm run typecheck` and `npm test` both pass
  locally (48 Vitest tests).

## Embeddings — full product surface (feat/embeddings-page)

The `embeddings` catalog entry is upgraded from the old single Stores admin
(`StoresModule`, now deleted along with `StoreListView` — superseded, not
duplicated) into a six-tab product over the REAL `hanzoai/ai` `/v1` backend.
`StoreEditView` + `stores/logic.ts` (`newStore`) are reused for the collection
editor + create; nothing is forked.

- **EmbeddingsModule** routes `''`→Overview, `:tab`→Overview/Explore/Collections/
  Jobs/Models/Settings, `collections/:name`→the store editor (unambiguous by
  segment count — same pattern as Models' `:tab`). The ONE create path
  (`add-store` + `newStore`) backs both the header "Create collection" and the
  Collections "New".
- **Collections = stores.** `EmbeddingsApi.collections` = `get-stores` → a
  `Collection` view-model; each maps to the Qdrant/Search index
  `{owner}-{store}-docs` (the backend's `GetSearchIndexName`). The store object
  carries NO vector count / dimension / index-size / `updatedTime`, and the metric
  is fixed to cosine at index-create — so those columns render an honest "—"
  (CREATED shows `createdTime`, the only timestamp; the metric is the real cosine).
- **Explore** → real `POST /v1/search?store=` (`{query,limit,mode}` → `{hits}`).
  Hits carry no per-hit score (backend RRF-drops it) so score reads "—";
  url/breadcrumbs are the locator. Model+Dimension are read-only collection
  metadata (search uses the store's own embedding config, not query-time).
  Vector-inspect is honest-empty (no point-lookup endpoint).
- **Models** = `/v1/models` filtered by id (no category field exists; many
  embedding routes are `hidden` and absent — honest); generate = real
  `POST /v1/embeddings` via the keyless `/ai` proxy (already allow-listed).
- **Jobs** = per-file index status (`get-files`: Pending/Processing/Finished/
  Error — there is no async job entity) + a real upload ingest
  (`POST /v1/docs/ingest`, source=upload).
- **Overview** metric cards (vectors/storage/queries/latency/cost) read
  `GET /v1/get-cloud-usages` — a forward-compatible client coded to the documented
  shape that degrades EVERY field to "—" with no sparkline today (the read API
  has no unique commits yet on `feat/cloud-usage-read-api`). The model donut is
  the real collection-by-model mix; dimension bars light up when metering reports
  per-dimension counts; index-health is per-collection state enriched best-effort
  with live `/v1/search/stats`.
- New: `src/lib/api/embeddings.ts` (`EmbeddingsApi`), the pure
  `components/products/embeddings/logic.ts` (+15 Vitest), and the dependency-free
  `components/ui/Charts.tsx` (Sparkline/Donut/BarChart — monochrome SVG, render
  nothing/"—" rather than a fabricated trend).
- Shared-infra touched: registry (`embeddings` row upgraded, not duplicated),
  `lib/api/index.ts` (barrel export). Reuses the unified `EmptyState`,
  `BackendStateCard`, `DataTable`, `PageHeader`, `PrimaryButton`, `Field*`.
- Drive-by: corrected a STALE assertion in `admin-policy.test.ts` — the
  `built-in` org-metadata owner was deliberately dropped in v0.7.15 (9b59dec,
  "standardize the global-admin org on 'admin'") but the test still expected the
  old wider allow-set; the gate code is unchanged (the tighter shipped policy is
  the correct one).
- Verification: `tsc --noEmit` clean, `vitest` 67/67 (8 files), `next build`
  green (14/14 pages). Authenticated visual e2e is gated behind a deploy + IAM
  session — left for live verification (the catch-all `/[...slug]` route that
  renders this compiled and type-checked).

## Native control planes — ZERO external link-outs + Hanzo Functions (claude/console2-native-control-planes)

Three deliverables, one PR, all over the one `/v1` surface (no `/api/` prefixes).

- **No external link-outs (the priority).** The catalog's `external` kind is GONE:
  `CatalogEntry` is now `module`-only and `ProductStatus` is `'enabled' | 'soon'`.
  Every product that used to open another domain in a tab (Gateway, DNS, CDN, MPC,
  CLI, SDKs, API, IDE, Desktop, Registry, Metrics, Crawl, Studio, Console) is now a
  native in-console route. They render ONE shared `NativeOverview`
  (`components/products/overview/NativeOverview.tsx`, wired via `overviewFor(id)` +
  `overviewRoutes(id)` in the registry — the DRY twin of `soonRoutes`): header +
  what-it-is, a REAL health band (probes `PlatformApi.apps()` for the product's
  operator service; honest "not deployed / not reporting" states, never a fabricated
  "operational"), key-fact cards (honest "—"), native primary actions (in-console
  routes only), and INLINE docs (rendered in-console; the docs SITE is a small
  secondary reference, never the way to use the product). Content is a pure
  `OverviewSpec` per product (`overview/spec.ts` + `resolve.ts` — a catalog-derived
  `defaultSpec` covers any product with no bespoke spec). The `external` branches in
  `open.ts`, `DashboardShell`, `AppLauncher`, `CommandPalette`, `ProductInterstitial`,
  and `OverviewModule` are removed — there is one way to open anything: a native route.
- **Hanzo Functions dashboard.** `FunctionsModule` is rebuilt from the old single
  `/paas/functions` table into a polished tabbed product (Overview · Functions ·
  Deployments · Triggers · Secrets · Settings, `:tab` route like GPUs/Models) over
  the rich `lib/api/functions.ts` (`GET /v1/functions*`). Branded **Hanzo Functions**
  with the honest **Fission** engine badge (the mock said "OpenFaaS", but the live
  engine per `go.mod` + `universe/infra/k8s/functions` is Fission — we label the real
  one). Overview: 6 KPI cards (Functions/Invocations 7D/Success/Avg duration/Errors/
  Cost) derived from real rows via `deriveOverview` (each degrades to "—"), with real
  series sparklines + `trendPct` deltas; an "Invocations over time" `LineChart` with
  1H/6H/24H/7D/30D range toggles; an "Invocation status" `Donut`; and the shared
  `FunctionsBrowser` (table + `DetailRail`, DRY across Overview and the Functions tab).
  All chart/donut/cost read `FunctionsApi.metrics(range)`; until that route is bound
  they show honest "time-series not connected" — never a placeholder trend. Secrets is
  names-only (values never fetched — Secret Manager principle). `functions/{FunctionsTable,
  DetailRail,parts}.tsx` (already built on the feature branch) are reused unchanged.
- **Overview "Explore products" — enablement gate dropped.** The home cards lose the
  Enabled/External/Soon `StatusBadge` and the open-vs-learn gate; every product is
  open-for-all with an "Open" (native) + a "Learn more" affordance (the native
  `/discover/:id` interstitial, which itself surfaces docs + OSS source inline — not a
  link-out).
- Idiom: strictly `@hanzo/gui` v5 shorthands (`bg`/`maxW`/`rounded`/`items`/`self`/
  `p`/`px`/`py`/`gap`), matching every existing module. New tests: `overview/resolve.test.ts`
  (spec resolution + honest default; the no-`external`/no-`href` invariant is enforced at
  compile time by the collapsed `CatalogEntry` union). Verification: `npm run typecheck`
  clean (0 errors), `npm test` 298/298 (31 files), and every route (`/functions/*`, all
  native overviews, `/`, `/discover/:id`) compiles + returns 200 on the dev server.
- Repo drive-by: removed the bogus tracked `node_modules` self-symlink blob (mode
  120000 → itself) that broke `npm install`/`vitest`; `.gitignore` already ignores
  `node_modules/`, so it was never meant to be committed.

## Living overview — one reusable, videogame-like overview across products (claude/living-overview)

The admin Platform Overview (KPI tiles + sparklines, usage/cost timeseries, revenue
donut, live activity, alerts, system-health) is now a **reusable `LivingOverview`
component system**, not a one-off. The old bespoke `OverviewModule.tsx` +
`AiMetricsModule.tsx` (+ its `aimetrics/{StatTile,UsageChart,format}` sub-parts) are
**deleted** — superseded, one overview system, DRY.

- **`src/components/products/overview/living/`** — the system:
  - `config.ts` — the DECLARATIVE contract: a `LivingOverviewConfig` names a product's
    tiles (`metric`/`timeseries`/`distribution`/`activity`/`alerts`/`health`, discriminated
    on `tile`) in ordered `rows`, a single REAL-data `load(ctx) => OverviewData`, and a
    `live` block (`pollMs` + `countUp`). Tiles read their slice out of the normalized
    `OverviewData` by key — a missing slice → honest empty tile (over-declaring is safe).
  - `motion.ts` (pure, unit-tested) — count-up curve (`countUpValue` lands EXACTLY on
    target), live-sparkline ring (`pushSample`), self-correcting poll clock
    (`shouldTick`/`effectiveInterval`, hidden-tab-paused). `hooks.ts` — the thin rAF/interval
    drivers (`useCountUp` animates from the CURRENT on-screen value on retarget — smooth;
    `usePoll`, `useReducedMotion`, `usePageHidden`), all self-cleaning (no leaked frames/timers).
  - `logic.ts` (pure, unit-tested) — the tile decisions: unit-aware `formatMetric`
    (count/cents/ms/pct, em-dash for non-finite), `deltaOf` (null → honest "—"), `hasTrend`
    (≥2 real points), status/health/severity colors, `mergeActivity` (dedupe+newest-first for
    the streaming feed), `windowRows` (virtualization), `worstHealth`/`healthTally`.
  - `tiles.tsx` — the thin animated tiles (reuse `ui/Charts` verbatim; count-up + live
    sparkline + skeleton/empty/error paths; the activity stream virtualizes past a viewport).
  - `LivingOverview.tsx` — the driver: ONE throttled poll loop (floored at 5s, paused when
    hidden OR errored), a `reqRef` race guard, range selector; a background refetch never
    blanks a board that already has real data (last real data stays until new lands); the
    first-load failure shows the shared `ErrorState`. `.hz-skeleton`/`.hz-pulse`/`.hz-row-in`
    keyframes in `globals.css`, all reduced-motion-guarded.
- **Backed by REAL `/v1` data, no mocks** (`adapters.ts`, pure, unit-tested): `fromCloudUsage`
  (commerce usage ledger → the platform + AI-usage overviews), `fromAdminOverview`
  (`src/lib/api/admin-overview.ts` — the `/v1/admin/overview` aggregate, optional-safe
  normalizer, degrades to honest empty on 404), `fromFunctions` (real inventory + metrics),
  `healthFromApps` (operator inventory → the health tile, composable into any board).
- **Wired across products** (`overview/living/registry.ts` — the declarative catalog):
  `overview` (platform centerpiece, rendered at `/` home AND `/overview`; primary source
  `/v1/admin/overview`, honest fallback to the real usage ledger + operator health so it is
  never blank), `ai-metrics` (commerce usage), `functions` (inventory + metrics), `gpus`
  (operator inventory). The product route's `''` renders `livingOverviewModule(id)`; the
  tabbed products keep their `:tab` module, reachable from the sidebar's level-2 sub-nav
  (declared `subpages`) so the overview is never a dead-end.
- **Adding a new product overview is one config** — no overview UI:
  ```ts
  // overview/living/registry.ts
  myproduct: {
    id: 'myproduct', title: 'My Product', subtitle: '…',
    live: { pollMs: 15000, countUp: true },
    rows: [
      [{ tile: 'metric', key: 'foo', label: 'Foo', icon: Zap }],
      [{ tile: 'timeseries', key: 'foo', title: 'Foo over time' },
       { tile: 'distribution', key: 'bar', title: 'By kind' }],
      [{ tile: 'activity' }, { tile: 'health' }],
    ],
    load: async ({ range }) => fromMyApi(await MyApi.overview(range)), // REAL data
  }
  // registry.tsx: const MyLiving = livingOverviewModule('myproduct'); route '' → MyLiving
  ```
- **All real, all tested**: `npm run typecheck` clean (0 errors), `npm test` 449/449 (42
  files; +78 new across motion/logic/adapters/registry/tile-contract/admin-overview,
  −10 from the deleted `aimetrics/format.test.ts`), `next build` green (14/14 pages).
  Visual proof (headless Playwright, no live session needed): the platform overview renders
  the full board with count-up KPIs + live sparklines + streaming feed + donut + health
  tally, values change across a 5s poll (live), the reduced-motion path snaps to real values
  with no error, and the `functions`/`gpus` overviews render their honest empty/error states
  (em-dashes + "not reporting" / "Could not load" + Retry) against a feed-less local backend
  without crashing.

## All-pages production build — external→native re-applied + billing/marketplace (claude/console-all-pages)

Branched off `main`; a completeness pass over the whole page taxonomy. Two audits
(a full catalog inventory + a per-module skeptical review) confirmed console2 was
**already ~95% production-complete**: ZERO mock modules, ZERO thin/incomplete modules
— every leaf hits a real `/v1`/proxy feed with honest loading/empty/error states. So
this pass is small and precise, not padding.

- **External→native re-applied (the priority fix).** `main` was inconsistent: `open.ts`,
  `match-core`, `NativeOverview`, `overviewFor` were all collapsed to a no-external world,
  but the registry STILL declared 14 `kind:'external'` entries (gateway, dns, cdn, mpc, cli,
  sdks, api, ide, desktop, registry, metrics, crawl, studio, console). Result: those 14 pushed
  `/${id}` → `resolveProductView` returned `notfound` → **hard 404 dead links** from the
  overview grid + app launcher. (The `claude/console2-native-control-planes` branch had fixed
  this but is 19 commits behind `main` and was never merged.) Fixed here by converting each to
  `kind:'module'` `routes: overviewRoutes(id)` (the DRY twin of `soonRoutes`), rendering the
  already-merged `NativeOverview` from its bespoke `OVERVIEW_SPEC`. `CatalogEntry` union
  collapsed to module-only; `ProductStatus` → `enabled|soon`; dead `external` branches removed
  from `DashboardShell`/`OverviewModule`; stale `ext`/`href` config trimmed. `resolve.test.ts`
  already pins all 14 specs; `match-core.test.ts` updated so the `kind`-guard fails closed for
  a non-module entry.
- **Subscriptions + Payment Methods** (`Observe`, next to `cost`/`plans`) — real commerce via
  the `/billing` per-tenant proxy: `GET /v1/billing/subscriptions`, `GET /v1/billing/payment-methods`.
  `billing.ts` gains `Subscription`/`PaymentMethod` types + normalizers that handle Stripe
  snake_case AND camelCase, the nested `card` object, and Unix-seconds/ms dates. Card data is
  **masked by construction** — the normalizer extracts only brand/last4/exp/isDefault; a
  PAN/CVV/token in the payload is dropped and never reaches the display object (a dedicated
  `billing.test.ts` leak test asserts it). Read-only; add/manage link to the brand portal.
- **Marketplace** (`Apps`, next to `chat`/`bot`/`search`) — the storefront over the real model
  catalog: `aicatalog.fetchCatalog()` → `GET /v1/pricing/models` via the authed `/ai` proxy.
  Category tiles + featured shelf (real catalog flag) + filterable listings with real per-Mtok
  pricing + Try-it→Playground CTA. Reuses the existing `aicatalog` client + `ProviderLogo` — a
  distinct storefront view over the SAME catalog, NOT a duplicate of Model Catalog/Providers.
  Pure `marketplace/logic.ts` (categorize/featured/applyFilters/marketStats) with 16 tests incl.
  a regex-injection guard (search is a literal substring filter).
- **Intentionally NOT built (honest):** Feature Flags / Backups / Support Tickets have NO backend
  anywhere in the Hanzo stack — adding permanent empty-state pages would be fabricated padding.
  Regions/Nodes duplicate `clusters`/`kubernetes`/`machines` (nodes derive from cluster node
  pools; there is no `/v1/machines` route by design). Jobs is intentionally Tasks (registry's own
  decision). No `Billing` category exists in `brand-scope.ts` — billing lives under `Observe`.
- **No cloud changes.** The billing sub-pages ride the existing `/billing/*` proxy (which already
  forwards any path with server-side org scoping); commerce already serves subscriptions +
  payment-methods natively. `go build ./clients/...` clean; cloud version NOT bumped.
- Verification: `npm run typecheck` 0 errors, `npm test` **406/406** (38 files), `next build` ✓
  compiled successfully (lint+types clean). Idiom: `@hanzo/gui` v5 shorthands only.
- **RED review fixes (billing-proxy tenant isolation — the one HIGH finding).** The `/billing`
  proxy's tenant scoping was INERT: it stamped `X-Hanzo-Org` (commerce reads `X-Org-Id` on the
  service-token path — `commerce/middleware/accesstoken.go`; the header fell back to the service
  org) and pinned only `?user=` (subscriptions filter `?userId=` — `commerce/api/billing/
  subscriptions.go`; with no `userId` the query returned every subject's rows = cross-tenant
  leak). Fix: send **`X-Org-Id`** (matching the `/ai` proxy) and pin the **FULL** subject-key set
  `{user,userId,customerId}` — identical to commerce's own `billingSubjectKeys` (`commerce/
  middleware/edgeauth.go`) — so no billing endpoint is left unfiltered whichever param it reads.
  The scoping is extracted to a pure `src/lib/server/billing-scope.ts` (`scopedBillingSearch` +
  `billingSubject`) and unit-tested (`billing-scope.test.ts`, 11 tests incl. the client-forged-
  subject overwrite + two-tenant disjointness). Also (defense-in-depth) `normalizePaymentMethods`
  clamps `last4` to the last 4 digits even if commerce puts a full PAN there (+ test). New live
  two-tenant isolation e2e (`e2e/billing-isolation.spec.ts`) asserts two distinct-org sessions get
  disjoint subscription/payment-method row sets through the proxy. `npm test` **487/487**.

## Consolidation — two Network modules onto main + one authoritative tag (v8.3.1)

The single-consolidator pass that ends the console2 deploy-war: main is the one
authoritative source, the operator CR is pinned to exactly what main builds, and
every stale session branch is pruned. Two genuinely-unmerged Network-category
modules land; everything else was already on main (verified by `git cherry`) and
was deleted, not re-merged.

- **Nodes** (`components/products/NodesModule.tsx`, `app/nodes/[...path]/route.ts`,
  `lib/api/nodes.ts`, `lib/products/brand-scope.ts` `nodeNetworksForBrand`) —
  per-node blockchain infrastructure (validators via P-chain
  `platform.getCurrentValidators` + peers via `info.peers`) over LIVE luxd RPC.
  Same-origin session-gated proxy (mirrors `/bootnode`), brand-scoped DATA
  (hanzo = all networks; lux/zoo/pars = own chain only), honest not-reporting per
  unreachable network. Tests: normalizers over real wire shapes + brand→network
  scope.
- **DNS** (`components/products/DnsModule.tsx`, registry `dns` entry) — per-org
  managed DNS (zones + records → CoreDNS + Cloudflare sync) on the unified
  `/v1/dns` surface; honest BackendStateCard states until the route is bound. The
  cherry-pick collided with main's existing DNS overview stub (same `id:'dns'`),
  resolved by upgrading that well-placed Network-cluster entry to render the real
  `DnsModule` and dropping the duplicate — one id, one entry.
- **Not merged (already on main, branches deleted):** the `/v1/iam` account
  reorg (revert-pair, net no-op; main has #20), the `cloud.hanzo.svc` default
  (main already there), the visor `:19000` default (main already ahead). The
  `api.hanzo.ai`-gateway default change was **rejected**: the CR documents that
  the DOKS pod's egress is Cloudflare-403'd on public `api.hanzo.ai`, so the safe
  env-less default is the in-cluster `cloud.hanzo.svc`.
- Drive-by: the pre-existing `observability/metrics.test.ts` null-override type
  errors are fixed (a `NullablePartial<T>` factory-override type) so
  `tsc --noEmit` is fully green.
- Verification: `tsc --noEmit` clean; `next build` is the authoritative gate
  (Node 24, on-cluster Kaniko — no GitHub builders). One tag `v8.3.1` from main
  HEAD, pinned in `universe/.../crs/console2.yaml`.

## Compute category wired per-org + rich Agents dashboard (v8.4.1, claude/console2-compute-agents)

Every Compute page is wired to its REAL backend, per-org, via the user-bearer BFF
proxies — and a customer (non-admin) never sees the admin `/paas` "PAAS_SERVICE_TOKEN
not configured" message. Plus a rich **Agents** dashboard over `/v1/agents`.

- **Backends, per page (one proxy each, org resolved from the minted user Bearer):**
  Machines / GPUs / Regions → **visor** `/vm/v1/{machines,gpus,sizes,regions}`;
  Agents / Functions / Prompts → **cloud** `/v1/*` (allow-listed in
  `proxy-allow.ts`); Containers / Applications → **paas** `/paas`; Tasks → **tasksd**
  `/tasksd/v1/tasks/*`; Edge → honest managed/coming-soon (no backend). Verified live
  in-cluster: visor `/v1/regions|sizes|gpus` = 200 real DO catalog + pricing,
  `/v1/machines` = 403 without the bearer (per-org); cloud `/v1/agents`/`/v1/functions`
  = 404 (concurrent cloud lane binding them), `/v1/prompts` = 200 `{data,meta}`; tasks
  `/v1/tasks/cluster/health` = 200.
- **Agents dashboard** (`AgentsModule` + `lib/api/agents.ts` + `agents/{parts,forms}.tsx`):
  five stat cards (Total / Active / Success 30d / Invocations 30d / Avg latency, spark+
  delta from the real series), invocations-over-time area chart with range toggles,
  Agent Health donut (active/idle/error/draft), agents table (status tabs + pagination,
  version badges, row → detail pane), Recent Activity feed, Top Agents bar list, and a
  30-day Resource Usage panel. EVERY number is real or derived (`deriveAgentStats`,
  `healthBreakdown`, `topByInvocations`, `deriveActivity`) — no fabricated 58-agents/
  1.92M-invocations. Zero agents (or `/v1/agents` 404) → a polished "create your first
  agent" empty state with a REAL New-Agent flow (POST `/v1/agents`; honest "not connected
  — use the CLI" on 404). 22 unit tests.
- **Machines** (role-routed): the customer branch (`CustomerMachines`) now renders the
  real region + size catalog with live pricing (`MachineCatalog` over visor
  `/v1/regions|sizes`) under the "Launch your first machine" state — never a blank
  spinner, proving the backend. Root cause of "not loading" (VISOR_URL unset) already
  fixed on main (proxy default `visor.hanzo.svc:19000` + CR env).
- **GPUs** (now role-routed like Machines): customer → `CustomerGpus` — the real visor
  GPU accelerator catalog (model/count/VRAM/host/price) + the org's own GPU machines;
  admin → the `/paas` operator fleet. The Overview route (`GpusOverview`) is role-aware
  (admin living-overview vs customer catalog). +4 visor catalog normalizer tests.
- **Containers**: the apps-inventory 403 is surfaced as the graceful "Managed control
  plane" card (was masked as a bare empty Workloads table).
- **Edge**: honest "coming soon / managed" state (no real edge backend), real nodes only
  if the platform ever reports them.
- **Shared decomplection** (`platform/state.tsx`): split 401/403 (`forbidden` →
  "Managed control plane", customer-appropriate) from 501 (`not-configured` → the admin
  PAAS_SERVICE_TOKEN hint). ONE fix removes the false infra-token claim for customers
  across every `/paas` module (Containers/Edge/GPUs-admin/Clusters/Kubernetes).
- **Already customer-safe, unchanged:** Applications (cloud `/v1`), Tasks (`/tasksd`
  per-user), Functions (`/v1/functions`).
- Verification: `tsc --noEmit` clean, `vitest` **639+ green** (all suites; +22 agents,
  +4 visor), `next build` ✓ 14/14 pages. Live visual verification as Dave is post-deploy
  (ships in the merge agent's authoritative image from main HEAD).

## Compute reads CONNECTED — live browser pass fixes (v8.4.2, claude/console2-compute-connected)

Logged in LIVE as Dave (davelorenzini@gmail.com, org maxpower) on console.hanzo.ai
(v8.4.1) and probed every Compute page from the authenticated page context. The
backends ARE up; the fixes are about pages that were CONNECTED but READ AS BROKEN.

- Live map as a customer: `/vm/v1/{regions,sizes,gpus}` = 200 real DO catalog+pricing;
  `/vm/v1/machines` = **403 "Unauthorized operation"** (visor authorizes the public
  catalog but denies the per-org list to a signed-in customer); `/v1/{agents,
  functions,prompts}` = 200 `{[]}` (connected, empty — maxpower has none); `/tasksd/
  {cluster/health,namespaces}` = 200 (connected, empty); `/paas/apps` = 403 forbidden.
- **Machines** (the visible bug): the page showed "Sign in to view your machines" next
  to the real 14-region + size catalog. `interpretVisorError` now maps **403 → connected
  `unavailable`** (only 401 = a real sign-in); `CustomerMachines` shows "Launch your
  first machine" + the live catalog for both 403 and empty — a signed-in user is never
  told to sign in. (+visor test updated.)
- **platform/state `forbidden`** reframed from a warning ("Managed control plane",
  TriangleAlert) to a CONNECTED state — **"Connected · managed by Hanzo"**, green
  `CheckCircle2`, no Retry — so Containers/Edge/Applications read connected, not error.
- **Applications** repointed from the casibase IAM **OAuth-application** admin
  (`get-applications`/`deploy-application` — an identity concern, mis-placed under
  Compute) to the **deployed application services** (`PlatformApi.apps()` → `/v1/apps`):
  real fleet for an admin, the connected "managed by Hanzo" + deploy-via-Functions/Agents
  state for a customer, honest "nothing deployed yet" when empty.
- **Agents** live 200-empty now shows a "Connected · no agents yet" badge above the
  "create your first agent" state, so it's unmistakably connected (not "not routed").
- **Proxy defaults hardened** (`/vm`,`/v1`,`/tasksd`): `?.trim() || default` (not
  `??`) so a VISOR_URL/CLOUD_API_URL/TASKS_URL reconciled to an EMPTY string still
  resolves the in-cluster service (observed env drift on the live pod — "keeps getting
  stripped"). Machines/GPUs now ALWAYS reach visor.
- Verified connected as Dave: Machines (real catalog + launch), GPUs (real accelerator
  catalog), Functions/Agents/Prompts (connected-empty), Tasks (connected-empty),
  Containers/Applications/Edge (Connected · managed). `tsc` clean; `vitest` green;
  `next build` ✓ 14/14. (Recovered from a concurrent-agent branch-switch that stashed
  these uncommitted edits — restored + committed in an isolated git worktree.)

## AI product surface LIVE over same-origin /v1/* + canonical shareable agent builder (v8.4.5, feat/console2-ai-surface-live-8.4.5)

The wave that (1) kills the Prompts/Evals 403, (2) makes the agent builder the ONE
canonical builder, and (3) collapses the AI surface to prefix-free `/v1/*`. Branched
off `main` (v8.4.4); commit only (CI builds the image).

- **ROOT CAUSE (verified vs cloud `clients/{prompts,agents,eval}.go` +
  `middleware_identity.go`).** Prompts + Evals made a cookie-only call to the cloud
  ORIGIN (`v1Url` → `cloud.hanzo.ai`). cloud's bearer surfaces resolve the org from a
  VALIDATED JWT owner claim (`SanitizeIdentity` → `tenant(c)`) and 403 a cookie-only
  request ("X-Org-Id required") — the live "Access required · GET /v1/prompts" card,
  same class as the "models missing" bug. cloud does NOT serve `/v1/get-account`
  (that's IAM/casibase, a DIFFERENT cookie), which is why get-account works cookie-only
  but `/v1/prompts` 403s. Agents already used the `/v1` bearer proxy → "Connected".
- **ONE-ENDPOINT-FORM — same-origin `/v1/*`, NO prefix (CTO law).** New `originV1Url`
  (`client.ts`) builds `<origin>/v1/<path>`. `next.config.mjs` `rewrites().beforeFiles`
  maps a CLOSED head list to the console's already-hardened server-side bearer proxies:
  `prompts|agents|evals` → `/v1`, `models|chat|embeddings|rerank|audio` → `/ai`. The
  client URL is `/v1/prompts`; the request terminates at OUR Next handler, which strips
  the cookie and mints a short-lived user bearer (`bearer-proxy.ts`). The raw session
  cookie NEVER reaches cloud-api → cloud-api carries no cookie-CSRF surface. This gives
  the clean URL WITHOUT weakening the bearer trust boundary. Repointed: `agents.ts`,
  `prompts.ts` (NEW facade), `evals.ts`, `models-catalog.ts`, `playground.ts`; `evals`
  added to `CLOUD_HEADS` (`proxy-allow.ts`). The rewrite CAN'T bypass least-privilege:
  it terminates at `/v1`|`/ai` whose `pathIsClean` (rejects `..`/`%2e`/`%2f`/double-
  encode/matrix-param) + `allowCloudSurface`/`ALLOWED` re-validate the NORMALIZED path
  (13 existing bearer-proxy traversal tests + new proxy-allow evals tests).
- **CSRF HARDENING (proactive, `bearer-proxy.ts` `sameOriginOK`).** The proxy
  authenticates from the first-party session cookie (auto-sent cross-site), so a
  MUTATING request (POST/PUT/PATCH/DELETE) now requires the `Origin`/`Referer` host to
  equal `Host` — fail closed (403) BEFORE resolving the user. Stops a cross-site POST
  from creating/deleting an agent or running a paid eval as the victim; belt-and-
  suspenders on the cookie's own SameSite. Safe methods (GET/HEAD/OPTIONS) pass. This
  protects EVERY proxy (`/v1`,`/ai`,`/vm`,`/paas`,`/tasksd`,`/billing`,`/commerce`),
  not just the AI surface (+7 tests).
- **CANONICAL AGENT BUILDER — ONE builder, zero duplication (CTO top principle).**
  `src/components/agent-builder/` is self-contained + schema-driven with NO host
  coupling (imports nothing from `~/lib/api`). It takes its data + effects as INJECTED
  loaders (`AgentBuilderLoaders`: `loadModels`/`loadPrompts`/`loadPromptBody`/`loadTools`/
  `createAgent`) over the ONE backend (`POST /v1/agents`). Lifts cleanly into
  `@hanzo/agent-builder`. `types.ts` (contract) + `logic.ts` (pure) + `AgentBuilder.tsx`
  (UI) + `index.ts`. DYNAMIC: Model = live `ComboBox` (type any id OR pick from the live
  `/v1/models` catalog); Prompt = selector of the org's saved prompts that fills the
  system prompt (Custom = free text — "selectable OR typed"); Tools = live `ComboBox` +
  chips. Every option set is REAL or the field degrades to typeable — never fabricated.
  New primitive `ui/ComboBox.tsx` + `combobox/filter.ts` (`filterOptions` is a LITERAL
  case-insensitive substring — never a compiled RegExp of user input; ReDoS-guarded).
  console2 wires it via `agents/loaders.ts`; `NewAgentForm` is a thin adapter.
- **Prompts UI:** `PromptsModule` uses the new DRY `PromptsApi` facade (mirrors
  `agents.ts`, defensive normalizers); list/detail/create/metrics over `/v1/prompts`.
- **Cloud-side direct-cookie path (FLAGGED, NOT done here):** `SanitizeIdentity`
  ALREADY validates a session-cookie JWT (`cookieTokenNames`). The "true" prefix-free
  direct path needs the console login to set the `iam_access_token` JWT cookie the
  sanitizer looks for — a CLOUD change on a separate branch. Making cloud accept the
  casibase session cookie directly would EXPAND cookie-CSRF to the cloud-api host, so
  it was deliberately NOT done; the clean `/v1/*` rewrite keeps the bearer BFF.
- **Unification map (research):** only `chat`/LibreChat has a real builder (Mongo
  `/api/agents`, model dropdown from `/api/models`); `app` (ai-supervisor=monitor,
  agents page=mock, Jan chat pkg=local), `hanzo.app` (dummy/marketing), `bot` (no code),
  `hanzobot/hub` (persona artifact registry — different concept), `team` (Huly fork).
  NONE call `/v1/agents` today. Migration = each surface supplies its own
  `AgentBuilderLoaders` for the ONE canonical `AgentBuilder` over `/v1/agents`.
- Verification: `tsc --noEmit` clean; `npm test` **773/773** (65 files; +7 filter,
  +14 builder-logic, +18 prompts normalizers, +4 origin-url, +6 loaders extractBody,
  +2 proxy-allow evals, +18 bearer-proxy CSRF/isolation/traversal; the stale
  `models-catalog` `/ai` assertion updated to the new same-origin contract);
  `next build` ✓ 14/14. Authenticated visual e2e is post-deploy.
- **RED review (fix-then-ship, 0 critical/high, 1 med, 2 low — all addressed):**
  - **MED-1 cross-tenant eval read.** RED found the isolation of `/v1/evals/scores`
    hung SOLELY on `/v1` dropping the client `X-Project-Id`, with no test guarding
    it (the cloud `clients/eval` `tenant()` PREFERRED the client-controllable
    `X-Project-Id` over the bearer org for KMS key selection). Fixed at BOTH layers:
    (a) console2 — a dedicated regression suite pins `upstreamHeaders` DROPS a
    client-forged `X-Project-Id` without `forwardScope` (`bearer-proxy.test.ts`); (b)
    cloud — `eval.tenant()` now uses ONLY the sanitized `c.Org()`, never a raw header
    (branch `fix/eval-tenant-project-id-isolation`, `TestTenantIgnoresClientProjectID`).
  - **LOW-1 CSRF (already shipped, then hardened).** `sameOriginOK` now also honors
    `Sec-Fetch-Site` (browser-set, JS-unforgeable) — a `cross-site` mutating request is
    refused outright, on top of the Origin/Referer host==Host check.
  - **LOW-2 end-to-end traversal test.** Added `forwardWithUserBearer` tests with a
    mocked fetch proving a rewrite-fed traversal (`%2e%2e`, `../`, `%2f..%2f`, `..;`,
    direct `v1/iam`) returns 404 and NEVER fetches upstream, while a clean `v1/agents`
    forwards to the exact normalized path — closing RED's regression-net gap (the prior
    tests only exercised `pathIsClean` in isolation).
  - RED refuted (live-probed): rewrite→allow-list bypass, org-forgery, ComboBox ReDoS,
    prompt/spec injection, rewrite shadowing, honest-state.

## Product-release versioning — one umbrella, two build lineages

Hanzo Cloud ships as ONE product under a shared **"Hanzo Cloud &lt;MAJOR.MINOR&gt;"**
release label (**8.4** today), but the two artifacts keep their OWN correct build
versions — do NOT try to make them equal:

- **console** (this app) — npm/Next, versioned from `package.json` (8.4.x). CI tags
  the image `:v<package.json version>`. Its `major.minor` IS the umbrella release.
- **cloud** (`github.com/hanzoai/cloud`) — a **Go module**, versioned by git tag
  (v1.786.x). It MUST stay **v1.x.x** forever (the "never bump Go above v1" rule +
  Go module semantics: v8 would force the `/v8` module path). It ships under the
  same "Hanzo Cloud 8.4" umbrella, not on 8.x.

The umbrella label has **one source**: the console app version. `next.config.mjs`
injects `NEXT_PUBLIC_APP_VERSION` from `package.json`; `config.ts` derives
`branding.release` (major.minor) + `branding.productLine` ("Hanzo Cloud 8.4"),
shown on the sign-in screen. Never hardcode "8.4" a second time.

## Billing usage visibility per agent/product + admin business board (v8.4.14, feat/billing-usage-admin)

Two deliverables over the ONE `/v1` surface, all real data with honest empties, no
fabrication. The metering-attribution wave: Dave sees "which agent/product cost me
$X", and admin.hanzo.ai gets a SaaS business control board.

- **Agent + product cost dimension (usage/billing visibility).** The commerce usage
  ledger row (`UsageRecord`, `lib/api/aimetrics.ts`) now extracts `product` and
  `agent` from `metadata.{product,agent}` (canonical contract — cloud emits agent
  usage tagged with them; alt keys `surface`/`agentName`/`agentId` also read). Cost
  Reports (`billing/logic.ts` `SpendDimension`) gains `product` and `agent`
  breakdowns beside `model`/`provider`; `presentDimensions` OFFERS a dimension only
  when ≥1 ledger row carries it, so the product/agent toggles appear the moment cloud
  starts tagging spend and show nothing (never a fabricated column) until then.
  `BillingReports.tsx` renders the new dimensions (provider stays a model-only
  secondary column). Per-agent cost in the **Agents detail pane** (`agents/forms.tsx`
  `AgentDetailView`) now reads the SAME charged ledger — a new pure `agentUsageFor`
  (`aimetrics.ts`, grouped by `metadata.agent`, matched by agent id OR name) drives a
  "Cost · charged ledger" section (cost/requests/tokens), NOT a hardcoded/registry
  metric; honest "—" + note until spend is attributed. New DRY rollup `perAgent`
  mirrors `perModel`.
- **admin.hanzo.ai business board (global-admin only).** New living-overview config
  `admin-business` (`overview/living/registry.ts`) rendered by the ONE `LivingOverview`
  — MRR, revenue, usage cost, active orgs, customers; revenue/usage-cost trend;
  revenue-by-product, plan mix, and top-agents-by-cost donuts; business alerts; live
  platform activity; fleet health. Primary source `/v1/admin/overview` (all-orgs god
  view via `allOrgs:true`), honest fallback to the real usage ledger + operator
  health so the board is never blank; business-only tiles stay honest-empty on the
  fallback. `admin-overview.ts` gains an optional named-`distributions` map
  (revenue/plans/topAgents), only present when the backend sends it (empty payload
  maps identically → no phantom tile); `fromAdminOverview` projects each named
  distribution into `distribution[key]`. Registry catalog entry `business` (Observe,
  `admin: true`) — hidden from every customer's nav/launcher/palette; `getAdminGate`
  + `useIsGlobalAdmin` gate it and the aggregate is server-gated. Reuses the ONE
  overview system — adding it was a config + adapter projection, no new overview UI.
- **Mobile-responsive by construction.** All new/changed surfaces use @hanzo/gui v5
  shorthands + `flexWrap="wrap"` rows with `flex`/`minW` tiles (LivingOverview rows,
  BillingReports controls, Agent detail Fact rows) — the 5-KPI business row and the
  two-donut rows wrap to stack on narrow viewports; no fixed grids.
- **Unverified backend contracts (flagged, built honest to them):** `metadata.{product,
  agent}` on commerce ledger rows, and the `/v1/admin/overview` `distributions`
  (revenue/plans/topAgents) + `mrr`/`revenue`/`orgs`/`customers` KPI keys. Each
  degrades to an honest empty tile / hidden dimension until the field flows.
- Verification: `npm run typecheck` clean; `npm test` **841/841** (68 files; +7
  aimetrics product/agent extract + perAgent/agentUsageFor, +5 billing-logic
  product/agent groupSpend + presentDimensions gating, +4 admin-overview/adapters
  named distributions); `next build` ✓ Compiled successfully (lint+types clean).
  Authenticated visual e2e (business board as a global admin) is post-deploy.

### RED review fixes — god-view server gate + attribution + row cap (v8.4.15)

RED reviewed v8.4.14 (0 critical, 1 high, 1 med, 3 low, 1 info). All actionable
findings fixed; the fixes are defense-in-depth + correctness, no behavior regression.

- **H1 (HIGH → fixed): the admin business god-view had NO console-side server gate.**
  `AdminApi.overview`/`activity` hit `${config.cloudUrl}/v1/admin/*` — same-origin in
  prod, but `admin/*` was NOT in the `next.config.mjs` rewrite heads and there was no
  `app/admin/overview` route, so the all-orgs (`?org=all`) aggregate rested SOLELY on
  an unverified casibase backend gate (RED correctly caught that `getAdminGate` guards
  only `/admin/iam`, `/admin/kms`, `/paas` — not the overview path). Fix: NEW
  `app/admin/aggregate/[...path]/route.ts` runs `getAdminGate` (global-admin only,
  fail-closed 403) BEFORE forwarding through the shared `forwardWithUserBearer`
  (traversal + same-origin-CSRF hardening) to cloud-api. `next.config.mjs` rewrites
  `/v1/admin/{overview,usage,orgs,audit,products}` → `/admin/aggregate/*` (iam/kms
  deliberately NOT rewritten — they keep their own tenant-scoped proxies). New
  `originGet` (`client.ts`) pins the request to the console's OWN origin (not
  `config.cloudUrl`), so a split-origin `NEXT_PUBLIC_CLOUD_URL` can't bypass the gate;
  `AdminApi` uses it. Least-privilege surface is the pure, tested
  `lib/server/admin-aggregate.ts` `allowAdminSurface` (admits only the read heads,
  REFUSES `admin/iam`/`admin/kms`/bare `admin`). M1 (client-only render gate) is
  downstream of H1 and now backed by a real server gate.
- **L1 (LOW → fixed, proven): `agentUsageFor` id-OR-name collision.** The old
  `Set([id,name])` union conflated two distinct agents within an org when one's id
  equalled another's ledger tag, or two shared a name. Fix: try the id FIRST, fall
  back to the name only when the id matched nothing — never a union. Two RED-proven
  collision cases added to the tests.
- **L2 (LOW → fixed, proven): unbounded cost table.** A high-cardinality dimension
  (agent/product tags are set at inference time) could render thousands of rows. New
  pure `capRows` (`billing/logic.ts`, `COST_ROW_CAP=100`) bounds the DOM to the
  top-by-spend prefix with an honest "N more · Show all" affordance that reveals every
  real row on demand (a render bound, not a trust boundary — the rows are the caller's
  own paid spend). Tested.
- **I1 (INFO → accepted-as-is):** `AgentDetailView` fetches the org ledger per open.
  Within the existing `/billing` proxy policy (any session sees its OWN org billing —
  the same data the Cost Reports page shows), so not a new trust boundary; left as-is.
- **RED-refuted (verified safe, unchanged):** the fallback path (`UsageApi.overview
  ({allOrgs:true})` calls `fetchUsageRecords()` with NO args; the `/billing` proxy
  drops `?org` and pins the full billing-subject key set — no cross-tenant leak);
  metadata forgery is org-scoped display only; `normalizeDistributions` DoS; honest-
  state (no fabrication); client nav/launcher/palette gating of `business`.
- Verification: `npm run typecheck` clean; `npm test` **853/853** (69 files; +6
  admin-aggregate allow-list, +4 agentUsageFor L1 collision, +4 capRows L2);
  `next build` ✓ Compiled successfully — the new `/admin/aggregate/[...path]` route
  is registered. Live re-test (org=all → 403 as a customer / org-admin) is post-deploy.

## Billing tab URLs unshadowed — data proxy namespaced under /billing/v1/* (v8.4.16)

Live-verifying v8.4.15 surfaced a PRE-EXISTING routing collision that made every
billing tab except Overview unreachable in the deployed app: `app/billing/[...path]/
route.ts` (the per-tenant commerce DATA proxy) claimed the WHOLE `/billing/*` URL
space, and a Next route handler always wins over the catch-all page for a matching
segment. So `/billing/reports`, `/billing/budgets`, `/billing/invoices`, `/billing/
subscriptions`, `/billing/payment-methods`, `/billing/credits` — the tabbed
`BillingModule` sub-routes (`router.push('/billing/<tab>')`) — resolved to the proxy
and returned commerce's `{"error":"not found"}` (or, for `subscriptions`/`payment-
methods`/`invoices`, raw ledger JSON) instead of the UI. This blocked live
verification of the v8.4.15 Reports cost-dimension (product/agent) surface.

Fix (one-way, minimal): the DATA proxy is namespaced under **`/billing/v1/*`**
(matching the "always `/v1/`" convention), so it can never share path space with a
UI tab slug; the tab URLs fall through to the SPA (`app/(dashboard)/[...slug]`).
- Route handlers moved: `app/billing/[...path]` → `app/billing/v1/[...path]`,
  `app/billing/topup/wallet` → `app/billing/v1/topup/wallet`. The forward target is
  unchanged (`commerce/v1/billing/<path>` — the moved `v1` is a static URL segment,
  not part of the `[...path]` array).
- Client callers prepend `v1/`: `billingUrl()` in `lib/api/billing.ts` +
  `lib/api/aimetrics.ts` (both build `/billing/v1/<path>`), and `wallet.ts`
  (`appUrl('billing/v1/balance')`, `appUrl('billing/v1/topup/wallet')`).
- Tests updated to the new data path: `aimetrics.test.ts` (asserts
  `/billing/v1/usage`), `e2e/billing-isolation.spec.ts` (fetches `/billing/v1/<p>`).
  UI nav paths (`/billing/reports`, …) are unchanged — they now render the tab.
- Verification: `tsc --noEmit` clean; `npm test` **874/874** (70 files); `next build`
  ✓ — route table shows `/billing/v1/[...path]`, `/billing/v1/topup/wallet`, and the
  `/[...slug]` catch-all that now serves the billing tabs. Live confirm post-deploy.

## Business-OS suite — CRM + Content + ERP/Help Center + Accessibility, one consolidated PR (v8.4.17)

Consolidates three OVERLAPPING Business-OS PRs — #38 `feat/console2-crm` (the
original, superseded), #39 `crm-work` (CRM + Accessibility), #42
`blue/business-apps-console` (CRM + Content + ERP/Help Center) — into ONE canonical
superset. The three diverged on the shared CRM files (a "two ways to do one thing"
violation); this is the single mergeable reconciliation. Five `category: 'Apps'`
entries, all native modules over the ONE `/v1` surface (NO `/api/` prefix),
org-scoped SERVER-SIDE.

- **CRM** (`crm`, enabled) — companies/contacts/opportunities over the REAL cloud
  `/v1/crm` (native-Go `clients/crm` on Base/SQLite, a port of Twenty's core model).
  `lib/api/crm.ts` is same-origin, keyless, prefix-free (`originV1Url('crm/...')` →
  `<origin>/v1/crm`, NOTHING before `/v1/`) — the EXACT Agents/Prompts/Evals form;
  the `crm` head terminates at the console's `app/v1` user-bearer BFF (org from the
  token owner claim; a cookie-only call 403s), `crm`
  allow-listed in `proxy-allow.ts` `CLOUD_HEADS`. `CrmModule` is one module, three
  collections via the `:tab` route — each a real list + inline create form + per-row
  delete, with `/v1/crm/summary` counts; honest loading / `BackendStateCard` /
  empty states, never placeholder rows. Defensive normalizers (unit-tested).
- **Content** (`cms`, enabled) — an honest in-console home for the live Content
  Studio (Payload headless CMS at `cms.<brand>`, white-label host derived from the
  console host); opens the Studio via IAM-SSO, NO fabricated content rows.
- **ERP** (`erp`) + **Help Center** (`helpdesk`) — real cloud primitives with no
  per-org console surface yet → HONEST `soon` (`routes: soonRoutes` → the shared
  `ComingSoon` waitlist), never a fake product.
- **Accessibility** (`accessibility`, enabled) — a Wix-style WCAG checker: Deque's
  axe-core (`import('axe-core')`, its own chunk, lazy) runs against the CURRENT page
  100% client-side (nothing leaves the tab; `resultTypes: ['violations']`). Pure
  sort/summarize/WCAG-label logic in `lib/a11y/scan.ts` (unit-tested, defensive);
  `AccessibilityModule` is only the panel (Scan button, per-severity cards, table).

Reconciliation decisions (DRY, one way):
- Kept **#39's `originV1Url` CRM data path** — it hits `/v1/crm` DIRECTLY (nothing
  before `/v1/`), the majority pattern across agents/prompts/evals/templates/
  analytics. #42's `cloudProxyV1Url` baked `/v1` before `/v1/` — a divergent
  second way (that helper stays for `functions.ts`, its existing owner; not used
  for CRM). Both terminate at the same hardened `/v1` bearer proxy.
- Kept **#39's `CrmModule`** — a strict superset of #42's (adds per-row delete +
  the `RowDelete` a11y-labelled control); everything else identical.
- Folded in **#42's `CmsModule`** + the `cms`/`erp`/`helpdesk` registry entries.
  Dropped #42's stray `gcp: 'Content'` on the cms entry (not a real GCP analog; the
  sibling Apps entries omit it).
- Regenerated `package-lock.json` for the new `axe-core` 4.12.1 dep (#39 had bumped
  `package.json` only — the lockfile was out of sync).
- #38/#39/#42 are superseded by this one PR (`feat/business-os-suite`).

- Verification: `tsc --noEmit` clean (0 errors); `npm test` **887/887** (72 files;
  +9 crm normalizer/route-contract + 4 a11y over main's 874); `next build` ✓
  Compiled successfully (14/14 pages, the `/[...slug]` catch-all renders every
  module). The crm route suite pins the same-origin `/v1/crm/{companies,summary,
  contacts,opportunities}` contract (never a `/v1`-prefixed URL, never a direct
  cloud-origin call). Authenticated visual e2e (the `(dashboard)` modules) is gated
  behind an IAM session → post-deploy; component-mount + the live axe-core scan were
  Playwright-verified locally.

## Bounded upstream timeouts — no request-time server fetch can hang (v8.4.21)

Investigated the "brand host (cloud.lux.network) hangs during render while
console.hanzo.ai is fast" report. **It does NOT reproduce in the app** — and it
CANNOT, by design: the page render path (`app/layout.tsx` + `(dashboard)/layout.tsx`,
the only server components) does ZERO per-brand network fetch. There is no
`next/headers`, no `cookies()`, no `generateMetadata`, no `server-only` render
fetch. Brand is resolved from `window.location` in the browser; SSR uses the
build-time `NEXT_PUBLIC_DEFAULT_HOST`, so the SERVER HTML is byte-identical for
every brand host (verified: `curl -H 'Host: cloud.lux.network'` and
`-H 'Host: console.hanzo.ai'` return the SAME md5, `<title>Hanzo Cloud Console</title>`,
HTTP 200 in ~4-18ms for lux/zoo/pars/hanzo alike). The prod origin difference is
therefore an ingress/routing artifact, not app SSR (out of scope — app code only).

The one real "no timeout → the route wedges" hazard IS in code: every request-time
server `fetch()` (the `/v1/*` BFF proxies + IAM/cloud identity resolution) had NO
upstream timeout, so a reachable-but-silent backend would block that route until
the client gave up — the exact failure class described. Fixed DRY with ONE
`src/lib/server/fetch-timeout.ts` (`fetchWithTimeout`): a bounded `AbortSignal`
COMPOSED with any caller signal (`init.signal`, e.g. `req.signal`), so a request
aborts on EITHER a client disconnect OR the timeout. Default `10_000`ms, env
`HANZO_UPSTREAM_TIMEOUT_MS`. On timeout it rejects like an aborted `fetch`, so
every existing catch turns an infinite hang into the existing honest fallback
(`resolveUser` → null → 401; proxies → 502). Threaded through `identity.ts` (all
5 IAM/cloud calls), `bearer-proxy.ts` (the shared proxy engine → cloud/ai/vm/
tasksd/commerce/superbase), `iam-proxy.ts`, and the custom proxies (`/paas`,
`/training`, `/admin/kms`, `/billing`, `/billing/topup/wallet`, `/waitlist`). The
`/nodes` per-brand luxd RPC probe was ALREADY bounded (`NODES_RPC_TIMEOUT_MS`) and
is left as-is. New `fetch-timeout.test.ts` (6 tests): resolves-before-timeout,
aborts-on-timeout, aborts-on-caller-signal, already-aborted, timer-cleared, and
the non-positive opt-out. Verification: `npm run typecheck` 0 errors, `npm test`
**823/823** (69 files), `next build` green (all routes), and the Host-header curl
test returns 200 fast for BOTH cloud.lux.network and console.hanzo.ai.

## Content de-link-out + native ERP/Help — embedded Business-OS apps (v8.4.22)

CMS was a `window.open` link-out and ERP/Help were `soon` placeholders. This wave
ports all three into the console as EMBEDDED (SSO iframe) or HONEST-provision
surfaces — no `window.open` as the primary path, no fabricated app data — binding
to the canonical Payload/Frappe backends (never reimplementing them). CRM stays the
native-`/v1/crm` reference; these three are the *embed* half of the Business-OS.

- **Ground truth (verified live + against the cluster/repos), the design driver.**
  All three apps are today SINGLE shared per-BRAND instances (`HANZO_ORG=hanzo`),
  NOT per-customer-org: `cms.hanzo.ai` (one Payload, one SQLite/bucket, JWKS+proxy
  IAM — framable, no XFO/CSP), `help.hanzo.ai` (LIVE Frappe Helpdesk, real hanzo IAM
  OAuth2 `hanzo-helpdesk`, framable), `erp.hanzo.ai` (**502 — no backend at all**;
  single-site Docker-Compose ERPNext **v15**, `frame-ancestors 'self'`, no per-org
  host, no platform one-click endpoint). So per-org isolation is NOT implemented for
  customer orgs — embedding hanzo's CMS for maxpower would be cross-tenant. The
  modules encode exactly this reality; they never claim isolation that isn't there.
- **`EmbeddedApp` (`components/products/embed/EmbeddedApp.tsx`) — the ONE way to
  frame a canonical app IN the console shell.** Full-height iframe (viewport-minus-
  chrome) with a permissive-but-scoped `sandbox` (SSO/forms/popups; SOP still blocks
  the cross-origin console parent), a real loading state, "Reload", and an honest
  "Open full screen" fallback + printed origin (an iframe can't report a cross-origin
  load failure — so it NEVER fabricates a loaded/failed verdict it can't observe).
  CMS/ERP/Help all render through it. `ProvisionPanel` is the DRY honest pre-provision
  surface (what-it-is + features + a REAL `/waitlist` provisioning request, honest 501
  when the intake is closed — never a lying "deployed").
- **White-label host derivation** (`lib/products/embed-hosts.ts`, PURE + tested):
  `cms|erp|help.<brand-domain>` from the console host (drop the service label), so a
  Lux/Zoo console frames ITS OWN app, never Hanzo's. Tenancy is NOT in the host (per
  the reality above) — the ORG comes from the shared IAM session inside the embed.
- **`/embed-status` BFF (`app/embed-status/route.ts` + pure `lib/server/embed-probe.ts`).**
  A cross-origin browser can't read another origin's status (SOP+CORS), so this
  session-gated server route probes the brand app once and returns `{origin, embedUrl,
  reachable}` — the module decides embed-vs-provision. **NO god-mode** (unlike the
  admin-gated `/paas`, it holds no service token): the probe target is `<app>.<brand>`
  CLAMPED to the known brand domains, so a forged Host header can never turn it into
  an SSRF probe of an arbitrary host (unit-tested: `console.evil.com` → `cms.hanzo.ai`).
  The probe `fetch` is `AbortSignal.timeout(4500)`-bounded (the v8.4.21 no-hang rule).
- **Modules** (`Cms/Erp/HelpModule.tsx`): CMS embeds the Studio ONLY for a brand-org
  member / global admin (never frames the brand's content for a customer org — that's
  the cross-tenant guard); a customer org gets the honest "a Studio for your org isn't
  provisioned yet" panel. ERP is a `soon`→`enabled` native module: `erp.<brand>` is
  502 so it shows the honest "Deploy ERP" panel (real provisioning request), and the
  SAME reachability gate embeds the real desk the moment one is live (the ERP side must
  also allow the console origin in `frame-ancestors`; until then "Open full screen" is
  the honest fallback). Help embeds the LIVE shared brand support desk for every
  signed-in user (Frappe scopes tickets per-user via SSO — no per-org gate, no leak).
- Registry: `erp` + `helpdesk` flipped `soon`→`enabled` with real modules; `cms`
  entry unchanged (now renders the embed/provision module, not the link-out).
- Verification: `npm run typecheck` 0 errors, `npm test` **914/914** (76 files; +21:
  9 embed-hosts, 8 embed-probe incl. the SSRF clamp, 4 embed client normalizer),
  `next build` ✓ Compiled (`/embed-status` + the `/[...slug]` catch-all registered).
  Live visual e2e (Dave/maxpower → honest provision states; a brand-org identity →
  the real CMS/Help embed) is post-deploy.

## Real per-product Status/Logs/Metrics/Settings + Base content-type builder + live PaaS Applications (v8.4.23)

Three deliverables, one console image; all real per-org data or an honest state,
never a broken/blank/fabricated page. DRY: ONE shared per-product sub-page system,
ONE Base binding, ONE PaaS client — nothing bespoke-per-product, nothing
reimplemented.

- **Per-product Status · Logs · Metrics · Settings are REAL per product (the
  #1 fix).** The uniform base sub-pages were the console's weakest surface: a
  single-screen product's `/x/{status|logs|metrics|settings}` fell to
  `ProductSubpageStub` (a "not wired yet" placeholder — the "broken/generic" the
  user saw), and a tabbed product's `:tab` route SWALLOWED those slugs into its
  default tab. Fixed with ONE shared sub-page system driven by per-product
  metadata, plus a routing precedence change:
  - **Routing** (`match-core.resolveProductView`): a base slug the product does
    NOT own as a declared specific now resolves to `{ kind: 'subpage' }` — the
    shared per-product view — taking precedence over any generic `:tab` route.
    A product that OWNS a base slug (Embeddings › Settings, Prompts › Metrics)
    keeps its bespoke route; a declared-but-unwired non-base specific still stubs.
    `subpageIsWired` now returns true for every base slug (always real → never
    dimmed in the nav). `ProductView` gains the `subpage` kind; the catch-all
    renders `ProductSubpageModule` inside the error boundary.
  - **Per-product metadata** (`components/products/subpage/sources.ts`, pure +
    tested): `subpageSourcesFor(entry)` derives — reusing the native-overview
    health spec — the product's status service, logs service, metrics feed
    (`o11y` for AI/LLM products, else `usage`), and settings feed. No 105 bespoke
    maps: sensible defaults + tiny override sets.
  - **The ONE shared system** (`components/products/subpage/`): `ProductStatusView`
    (real per-service health from `PlatformApi.apps()` filtered to the product's
    service; admin → live verdict + workloads table, customer → honest "Connected ·
    managed by Hanzo", no service → honest managed card — never a fake green),
    `ProductLogsView` (real `/paas/logs?service=` filtered to the product; honest
    states), `ProductMetricsView` (AI/LLM → the real org o11y `MetricsModule`
    verbatim; else the commerce usage ledger filtered to the product tag, honest-
    empty), `ProductSettingsView` (real deployment facts — image/tag/cluster,
    read-only — + an org-Settings pointer; never a dead form), and the
    `ProductSubpageModule` dispatcher. Coverage map: `status`/`logs` are real for
    operator-managed products (admin) and honest-managed for customers/serviceless
    products; `metrics` is real o11y for {models, providers, inference, chat,
    agents, playground, embeddings, prompts, gateway, api} and per-product usage
    (honest-empty until tagged) for the rest; `settings` is honest-managed +
    real deployment facts everywhere (no product ships a fake editable form).
- **Base is a Supabase-style content-type dashboard (the #2 fix).** The `base`
  product (was the superbase *tenants* list) is now the per-org Base dashboard:
  list content types (collections) · **build a new content type** (name + typed
  fields incl. File/Media and Relation) · click a type to browse/edit its records.
  ONE Base binding — console2's OWN `/superbase` proxy (mints the user IAM bearer,
  stamps `X-Org-Id` from the JWT owner → persists to THIS org's Base). We do NOT
  reimplement Base; we drive its real `/v1/collections` API.
  - `base-data/api.ts` `BaseDataApi` gains `createCollection` (POST
    `/v1/collections`) + `deleteCollection`; the browse half (`CollectionTable`/
    `RecordDetailView`, shared with `Records`) is reused unchanged.
  - `proxy-allow.ts` `allowBaseSurface` widened to admit single content-type admin
    (`v1/collections/<name>`) + the scaffolds palette — still Base-superuser-gated
    + per-org (`X-Org-Id`); it STILL refuses Base's non-collection admin
    (settings/backups/logs), so `/superbase` stays a collections proxy, not a
    tunnel. (POST `/v1/collections` was already allowed by the existing
    `v1/collections` rule.)
  - `components/products/base/`: `logic.ts` (pure + tested — the 12-kind field
    palette incl. file/relation, validation, and the field→Base-payload mapping),
    `CollectionBuilder.tsx` (the table-editor form), `BaseDashboard.tsx` (index +
    builder + records routes). `BaseModule` is a thin adapter over it. Registry
    `base` routes → `'' · new · :collection · :collection/:id`.
- **Applications shows the org's REAL deployed apps on the LIVE PaaS.** The
  Compute → Applications page was a generic "managed by Hanzo" placeholder over the
  admin `/paas` inventory. It now drives the live per-org `/v1/platform/*` surface
  (projects → apps → deployments) through the `/v1` bearer proxy (org resolved
  from the Bearer owner — a caller sees only their own apps). New `lib/api/paas.ts`
  `PaasApi` (projects/apps/deployments CRUD + `deploy` + `listAllApps` aggregate;
  plain-JSON transport like `functions.ts`), `platform` added to `CLOUD_HEADS`.
  New `components/products/paas/` `PaasApplications` (real app list with status +
  source + live URL, a **New app** deploy flow — project + git/image → build →
  live, and an app detail rail with deployment history + build status + redeploy)
  + pure `logic.ts` (tested). `ApplicationsModule` is a thin adapter. `StatusTag`
  learned the PaaS lifecycle words (live/building/deploying/succeeded/queued/…).
- Verification: `tsc --noEmit` clean; `npm test` **922/922** (76 files; +6
  subpage-sources, +18 base-builder logic, +12 paas logic, +2 proxy-allow base,
  +8 match-core subpage routing); `next build` ✓ (all routes). Live visual e2e as
  Dave (maxpower) is post-deploy.

## Embed entitlement gate — RED hardening of the CMS/ERP/Help embeds (v8.4.24)

RED reviewed v8.4.22's embeds (0 critical; SSRF clamp, iframe SOP, no-credential-
injection, honest normalizers all REFUTED) and flagged the console residuals: the
embeds *asserted* a server-side `org==tenant` guarantee the shared single-tenant
apps can't back, `/embed-status` handed the embed URL to any authenticated org, and
Help embedded the shared desk for everyone. Fixed:
- **Server-side entitlement gate.** `/embed-status` now resolves the caller's org
  (token owner) and returns `entitled` per app. cms/erp/help are ALL brand-owned
  single instances (`EMBED_OWNERSHIP` in `embed-probe.ts`), so a non-owning (customer)
  org gets `entitled:false`, **no embed URL**, and no probe — the module shows the
  provision panel. Only a brand-org member / global admin gets the embed. This is the
  AUTHORITATIVE gate (the old client `account.owner===iamOrgName` check was cosmetic);
  `brandOrgForHost` maps the SSRF-clamped brand domain → owning org. Client normalizer
  fails closed (`entitled` strict-true; a stale server → provision panel, never a frame).
- **Help is now brand-owned too** (was embed-for-all) — a customer never frames the
  shared Frappe Helpdesk (removes the unverified cross-org ticket-visibility risk);
  they get an honest "Help Center for your org" provision panel.
- **Dropped the false isolation claims** in `EmbeddedApp`/`embed-hosts`/module
  docstrings (the console gates WHO it frames; a shared app still owes its own per-org
  isolation — the root CMS per-org tenancy is a separate CMS-side fix).
- **Trimmed the iframe sandbox** (dropped `allow-top-navigation-by-user-activation`,
  `allow-popups-to-escape-sandbox`, `clipboard-read`).
- **`/waitlist` hardened**: the recorded email is bound to the session account (can't
  enroll `victim@othercorp`); stopped forwarding the forgeable `X-Forwarded-For`.
- Verification: `tsc` clean; `npm test` **+13** embed tests (entitlement + brand-org
  map + fail-closed normalizer); `next build` ✓ (`/embed-status` + `/[...slug]`).

## Honest-state punch-list — signed-in 403≠"sign in", read-402≠paywall, graceful re-auth, chunk self-heal (v8.4.25)

A patch above #49's v8.4.24 (whose CMS/ERP/Help entitlement gate is preserved
untouched). Closes the "renders real → every state honest" punch-list. All DRY —
one fix per shared primitive, no per-module snowflakes.

- **P1 — a SIGNED-IN 403 is NEVER "sign in" (3 broken pages + every 403 surface).**
  Finetuning (`/training`→`/v1/train/jobs`), Dashboards + Annotation Queues
  (`/v1/o11y/*`) told a logged-in user to "sign in" on a 403 — reads like a bug
  ("I AM signed in"). Root: the THREE shared error mappers conflated 401 and 403.
  Fixed in ONE place each: `BackendState.classifyBackend` (+`signin` kind),
  `observability/RuntimeNotice.classifyRuntime` (+`signin`), and
  `ui/States.honestError` (+`reauth`). Now **401 = session lapsed** → "Your session
  expired" + a graceful **Sign in again** action; **403 = signed-in-but-not-enabled**
  → honest "not enabled for your organization / admin-only surface" (o11y points to
  the real AI Metrics), never "sign in". Covers finetuning/dashboards/annotation-
  queues AND every other surface using these mappers (evals/datasets/prompts/
  settings/IAM/KMS/…).
- **P2 — a READ is never credit-gated (S3 402→"add credits").** Listing S3 buckets/
  objects that 402'd showed the "Add credits to continue" paywall on a READ. New DRY
  `BackendState.classifyRead` maps a 402-on-read → `null` → the caller's honest EMPTY
  state ("No buckets yet · Create one"), not a wall. `StorageModule` uses it for both
  the bucket list and the object list. (A paid WRITE still surfaces the billing
  message via the create toast — the paywall belongs on the write, not the read.)
- **P3 — graceful mid-task re-auth (session).** A mid-task expiry no longer dumps the
  user on `/`. New `auth/iam.ts` `stashReturnTo`/`takeReturnTo`/`startReauth`: `signIn`
  + `signInWith` (session.tsx) and every P1 `signin` card remember the current path
  (same-origin-only, auth-pages excluded) before redirecting to IAM; the `/auth/
  callback` lands the user **back where they were**. NOTE: token/session TTL itself is
  an IAM/cloud config concern (not console-side) — FLAGGED for the IAM lane; the
  console side (return-to + one-click re-auth) is done.
- **P4 — chunk-load self-heal hardened (the sweep's crash class).** A stale-deploy
  chunk error thrown during React RENDER hit the error boundary (a manual card), and
  the HTML-as-JS signature ("Unexpected token '<'" — a 404'd chunk served the SPA
  shell) wasn't even recognized as a chunk skew. Fixed: `boundary-logic.isChunkLoadError`
  now matches that signature (kept in sync with `ChunkGuard`), and the dashboard
  `error.tsx` AUTO-RELOADS once-per-window (shared guard key with `ProductErrorBoundary`
  — never double-reload) instead of stranding a card. So a redeploy self-heals at
  BOTH the product-boundary and segment-boundary levels + the window listeners.
- **Buttons:** self-audited — no dead/no-op `onPress`; the disabled CTAs
  (Containers/Kubernetes "Create …") are honest `HintButton`s with a reason, not dead
  buttons. The Base builder + Applications deploy buttons were verified working live
  in v8.4.23. (The separate interaction-sweep agent's specific button list wasn't
  accessible from here; its findings fold into a follow-up if any remain.)
- Verification: `tsc --noEmit` clean; `npm test` **953/953** (79 files; +6 boundary
  HTML-as-JS chunk cases); `next build` ✓. Live re-verify (the 3 pages honest, S3
  read empty-not-paywall, #49's entitlement gate still holds) is post-deploy.

## Record-form data-loss fix + Memory/Datasets delete + session-TTL flag (v8.4.27)

Interaction-sweep punch-list (43/45 buttons already worked). The one SERIOUS bug —
record forms with no inputs (silent data loss) — plus two delete affordances; the
"5-min logout" is diagnosed as a BACKEND concern (not a client change).

- **[BUG, data loss] Base/Records create+edit forms rendered ZERO inputs → blank
  rows.** `@hanzo/data`'s `RecordForm` renders a label then `FieldInput` per field,
  but `FieldInput` returns `null` when no Input is registered for the type (unlike
  the read router `FieldDisplay`, which has a fallback). The input registry is
  populated ONLY by an import SIDE EFFECT (`registerDefaults.ts` self-invokes), yet
  the package ships `"sideEffects": false` — so production webpack tree-shaking (we
  consume `@hanzo/data` via `transpilePackages`) PRUNES the registration. Registry
  empty → every field input is `null` → the form shows labels with NO inputs, a user
  can't type, and "Create" persists a BLANK record. (It worked in `next dev` — no
  tree-shaking — which is why only post-deploy broke; matches "Base proved editable
  locally".) **Fix (2 lines, DRY):** `Provider.tsx` imports and CALLS
  `registerDefaultFields()` at module scope — a USED binding webpack cannot drop, so
  the registry is populated app-wide (Base + Records + any future editable
  `@hanzo/data` surface). Idempotent, no window/DOM (SSR-safe). Root-fix flagged for
  the package: drop/scope its `sideEffects:false`.
- **[BUG] Memory Open/Delete broke on `/memory/undefined`.** `MemoryApi` returned
  raw rows with NO key normalization; the backend keys memories by `name` (like KMS
  secrets / Base collections), so a row often had no `id` → `/memory/<undefined>` →
  "this memory no longer exists", and delete/update mis-keyed. **Fix:** new
  `normalizeMemory` derives a stable `id` from the first present of
  `id/name/key/memoryId/memory_id/_id`, mapped in list/search/recall/remember/update
  so the whole module (open link, rowKey, edit, delete) works whatever the backend
  calls the key; `update`/`remove` send the key as BOTH `id` and `name` (robust
  whichever the backend reads). Memory already HAD delete buttons (list row + detail)
  — they now hit the right key. (+5 normalizer tests.)
- **[minor] Datasets — row-level delete.** `EvalsApi.deleteDataset` was present but
  unused; `DatasetsModule` now renders a per-row delete (confirm → real
  `DELETE /v1/evals/datasets/:name`, org-scoped, removes the dataset + its items →
  reload). One shared honest-delete pattern with Memory's name-keyed delete.
- **[the 5-min logout] Diagnosed as a BACKEND/IAM concern — flagged, not a client
  change.** The console session is an httpOnly cookie (`/v1/iam/signin`) + server-
  minted short-lived bearers (`issue-user-token`); the browser holds NO access/
  refresh token. So a client-side `grant_type=refresh_token` would REQUIRE putting a
  refresh token in the browser — an XSS-stealable SECURITY REGRESSION of the httpOnly
  model — and a keep-alive auto-reauth could redirect-loop on a hard session TTL. The
  real fix is the session/token TTL + slide-on-activity (IAM/cloud config — the
  coordinator's own iam#89 stages 1h-access), NOT console code. The correct console-
  side mitigation already SHIPPED in v8.4.25 (P3): graceful re-auth that returns the
  user to their exact task after re-signing in. Part of the observed "5-min logout"
  was also the test harness's concurrent shared-session sign-outs (a test artifact).
  Deliberately shipped no client token-handling.
- Verification: `tsc --noEmit` clean; `npm test` **970/970** (80 files; +5 memory
  normalizer); `next build` ✓ (15/15). Live re-verify (create a record with real
  values → persists non-blank; Memory Open+Delete; Datasets delete) post-deploy.

## Silent token-refresh — durable console OAuth session, no mid-task logout (v8.4.29)

Corrects v8.4.27's "5-min logout is a BACKEND concern, no client change" call. The
console had ZERO `grant_type=refresh_token` and pinned the AuthGate + every BFF proxy
to the cloud **casibase session cookie** (`cloud_session_id`) — a session it does not
own and cannot refresh, so it can lapse out from under a working tab and bounce the
user. IAM was already secure (7-day access + rotating/revocable 30-day refresh,
`grant_type=refresh_token` live). v8.4.27's "refresh needs a browser-held refresh
token (XSS)" was the wrong frame: the refresh is **server-side (BFF)**.

Ground truth (verified live against hanzo.id + cloud, in-cluster): `hanzo-console` is
a confidential client that supports `password` + `authorization_code` + `refresh_token`
with `offline_access` (returns a rotating refresh token); its access token is a hanzo.id
JWT `aud=hanzo-console` / `iss=https://hanzo.id`, which cloud's `SanitizeIdentity`
accepts (deployed `GATEWAY_ALLOWED_AUDIENCES` includes `hanzo-console`). The casibase
`cloud_session_id` is actually durable (1-yr GC, session-scoped cookie), and it is
LOAD-BEARING for the casibase admin surfaces (providers/models/stores/chat) + a couple
of session-only reads (get-account, get-cloud-usages) — so it is KEPT, not replaced.

The fix is **additive, one session manager, zero regression** (worst case === v8.4.28):
- **`src/lib/server/session.ts`** — THE token manager (server-only by construction:
  `node:crypto` + `next/server`). Sealed AES-256-GCM (key = HKDF(`IAM_MINT_CLIENT_SECRET`);
  no-secret → per-process random key, never a constant). IAM tokens are ~3.6 KB
  full-user JWTs (86 claims incl. password hash / TOTP secret) — the ACCESS token and
  the REFRESH token are BOTH that big — so a single cookie is impossible (browser ~4 KB
  per-cookie cap; a real browser silently REJECTS an oversized cookie — a bug curl never
  surfaces). Hence TWO httpOnly+Secure+Lax, 30-day cookies:
    - `hz_session` (Path=/, ~1 KB): the sealed IDENTITY — `{access-exp, PROJECTED
      claims}`. `sealSession` projects the access JWT to the small display/authz claim
      set (`accessClaims`) and discards the raw token (never stored/logged — no secret
      material). resolveUser + every BFF proxy + /auth/session GET read this; small, so
      it rides every request with no header bloat / gateway-431 risk.
    - `hz_rt` (Path=/auth, chunked `hz_rt0/hz_rt1`): the sealed REFRESH token, scoped to
      /auth so the big blob is sent ONLY to /auth/refresh|session (never /v1 or the BFF),
      and CHUNKED (`setCookies`/`readRefreshToken`) because sealed 3.6 KB > one cookie.
  `consoleSession(req)` reads the identity claims (AEAD-trusted — the seal IS the
  integrity anchor, no JWKS round-trip; only `exp` re-checked, 60s skew).
- **`app/auth/session/route.ts`** — POST establishes the console session for the
  signed-in user (server-side `passwordGrant`), **gated**: the caller must already be
  authenticated (a valid casibase session, `resolveUser`) AND the grant must resolve to
  the SAME principal (`sameSubject`) — so it can never run standalone with a stolen
  password and never bypasses MFA (MFA logins hand off to the hosted flow and never
  reach it). GET = the account from the console session (AuthGate reads this first).
  DELETE = sign out (revoke + clear).
- **`app/auth/refresh/route.ts`** — silent `grant_type=refresh_token`, rotation-aware
  (persists the NEW refresh token). NEVER clears the cookie on failure (multi-tab
  rotating-token race safety — a lost-race 401 must not nuke the winner's fresh cookie);
  only sign-out clears.
- **`resolveUser`** (identity.ts) prefers the console session (`consoleClaims`), falls
  back to the casibase get-account. So the AuthGate + `/v1` bearer-proxy both read the
  ONE session manager (the coordinator's constraint), casibase as graceful fallback.
- **Client**: `lib/auth/refresh.ts` = single-flight `refreshSession()` (rotating tokens
  MUST NOT race). `session.tsx` arms a PROACTIVE timer at 80% of the access lifetime
  (only when < 2h — short tokens post the IAM 1h-access hardening; long tokens rely on
  reactive). `client.ts` `authedFetch` = REACTIVE (a 401 on any cloud/BFF call → refresh
  once → retry). `account.ts` `session()` self-heals on load (console GET → on miss,
  refresh once → retry → else casibase). `SignInForm` upgrades a password login to the
  console session (best-effort; a failure leaves the user on casibase — login never
  blocked). Social/MFA logins run on casibase (durable) unchanged.
- Unblocks the IAM 1h-access hardening (iam#89, universe#290): once the access token is
  1h, the proactive timer (48min) + reactive 401 keep the session warm — no bounce.
- Verification: `tsc --noEmit` clean; `npm test` **1001/1001** (83 files; +20 session
  seal/open/claims/grants/sealSession, +4 refresh single-flight, +5 resolveUser
  precedence); `next build` ✓ (`/auth/session` + `/auth/refresh` registered). Live-verified
  as z@hanzo.ai (curl + Playwright, prod): establish → 200 + `hz_session` (Path=/,
  ~1 KB, browser-safe) + chunked `hz_rt0/1` (Path=/auth) — all httpOnly; Secure; SameSite=Lax;
  Max-Age=2592000; GET /auth/session with `hz_session` ALONE → 200 (account hanzo/z, isAdmin)
  — self-sufficient; POST /auth/refresh → 200 + ROTATED refresh; replay of the OLD refresh
  token → 401 (one-time-use enforced). Browser: login stores the cookies, stays authenticated
  past 5 min (navigate + idle), no /signin bounce.
  `NEXT_PUBLIC_*` unchanged (no client-id switch); server-only env reused
  (`IAM_MINT_CLIENT_ID/SECRET`, `IAM_URL`) — no new secret to provision.

## admin.<brand> login — BOTH legs use admin-console (PKCE, no secret) (v8.4.76)

admin.hanzo.ai authenticates into the reserved `admin` org via the PUBLIC `admin-console`
app. TWO legs, and BOTH must speak admin-console or IAM rejects the token as "the token is
for wrong application (client_id)":

- **Leg 1 (authorize) — already fixed (v8.4.75).** `iam-login.ts` POSTs `hanzo.id/v1/iam/login?clientId=admin-console`
  with `{application:"admin-console", organization:"admin"}` on an admin host → 200, a code minted for admin-console.
- **Leg 2 (redeem) — the fix here.** The redeem used to POST the console's OWN origin
  `/v1/iam/signin`, which the ingress routes to the CLOUD backend (casibase); casibase
  redeems with ITS confidential `hanzo-cloud` client → mismatch. Now the console redeems
  the code ITSELF: on an admin host `iam-login.ts` authorizes with **PKCE** (S256
  `codeChallenge` in the login body — IAM stores it with the code), and
  `completeSignIn` posts `{code, codeVerifier}` to the new BFF **`app/auth/signin`**, which
  runs `pkceCodeGrant(client_id=admin-console, code, code_verifier)` with **NO client secret**.
  Verified in IAM source (`object/token_oauth.go` GetAuthorizationCodeToken 880-896): an
  empty secret + a matching S256 verifier is admitted for a confidential app (RFC 7636
  public-client path). Probed live: admin-console has `authorization_code`+`refresh_token`
  grant types and accepts the empty-secret exchange. Tenant hosts are UNCHANGED (no
  challenge; the cloud backend redeems with `hanzo-cloud`).

- **`durableSessionClientId(host)`** (session.ts) is the ONE host→client decision:
  admin host → `admin-console` (public — pkceCodeGrant + secretless refreshGrant), else null
  → the confidential `hanzo-console` path. `/auth/refresh` uses it so an admin session
  refreshes with admin-console (IAM skips the secret check when it's empty, token.go 469).
- The admin session rests on `hz_session` (the code grant returns access + refresh, minted
  at authorize time), which `resolveUser`/`getAdminGate` read FIRST — so the admin console
  works without the casibase cookie. `accountOf` + `applyCookies` extracted to session.ts
  (shared by /auth/session, /auth/refresh, /auth/signin — one writer). `createPkce` (Web
  Crypto S256) is the one PKCE source.
- Verification: `tsc --noEmit` clean; `npm test` **1578/1578**; `next build` ✓ (`/auth/signin`
  registered). No new secret to provision (PKCE is secretless).

## Bots + Machines — two `kind` compute-analytics operator boards over the datastore (feat/console2-admin-fleets)

Two GLOBAL-ADMIN boards on admin.hanzo.ai (Observe, beside Business + Finance) —
**Bots** and **Machines** — two lenses over ONE datastore table, split on `kind`:
a **bot** is a machine running the @hanzo/bot agent (booted, gateway-connected); a
**machine** is raw compute visor opens. Each surfaces per-org/app/project count,
active, and spend, grouped org → app → project. Reads ONLY the datastore aggregate
(one cross-tenant GROUP BY, never a per-tenant SQLite fan-out — the
tenant-data-hierarchy invariant). Supersedes the initial single "Fleets" board (the
noun was wrong: bots and machines are distinct compute kinds, not one "fleet").

- **One admin aggregate head, zero new plumbing.** `compute` added to the existing
  global-admin-gated surface: `ADMIN_AGGREGATE_HEADS` (`lib/server/admin-aggregate.ts`)
  + `ADMIN_V1_HEADS` (`next.config.mjs`). The client calls same-origin
  `/v1/admin/compute?kind=bot|machine`; `next.config.mjs` rewrites it to
  `app/admin/aggregate/[...path]`, which runs `getAdminGate` (fail-closed 403,
  global-admin only) BEFORE forwarding a minted user bearer. Same RED-H1 gate as
  Business/Finance — no new proxy/trust boundary.
- **`lib/api/admin-compute.ts` — kind-parameterized client + pure tree.** OPTIONAL-SAFE
  over BOTH shapes: pre-aggregated `{ leaves }` (the cheap datastore GROUP BY) OR raw
  `{ events }` (the coordinated 9-column datastore row: `org, app, project, kind, event,
  machine_id, size, price_cents, ts`), which pure `foldEvents` folds client-side.
  `normalizeCompute(raw, kind)` filters to the requested kind (defensive — the endpoint
  filters too); Rollup = `{ count, active, spendCents }` (count = distinct units of that
  kind, active = latest event non-terminal). Pure `buildTree` rolls up app + org, sorts
  by spend desc; snake_case + camel tolerated; garbage → empty tree, zero totals.
- **`ComputeModule.tsx` — ONE board, two exports.** `ComputeBoard({ kind })` renders
  totals KPIs (count/active/spend) + a collapsible org → app → project tree with
  per-leaf size chips + last activity; `BotsModule` / `MachinesModule` are thin
  `kind='bot'|'machine'` wrappers (Bots and Machines are the same board). Honest states:
  loading, operator-access-required (403), not-routed (404), error, empty. Both catalog
  entries `admin: true` (hidden from every customer). Registry ids `bots` + `vms`
  (the admin machines lens; the per-org customer `machines` entry — visor
  `/vm/v1/machines` — is a different, non-admin surface, so its id is kept and the admin
  one imports `MachinesModule as AdminMachinesModule`).
- **Backend SHIPPED (paired PR).** cloud-api `GET /v1/admin/compute`
  (`clients/admin/compute.go`, `app.Get(..., s.guard(s.compute))`) aggregates
  `hanzo.compute_events(org, app, project, kind, event, machine_id, size, price_cents,
  ts)` grouped by `(org, app, project, kind)` over the shared `aiobject.DatastoreQuery`
  (the `clients/analytics` transport; stays **v1.x.x**). `?kind`/`?org` filter,
  `?range=24h|7d|30d` bounds; two-level roll-up (inner `argMax(event,ts)` per machine →
  outer count/active/sum). Honest-empty when the warehouse/table isn't wired yet (the
  visor/commerce emitter is still pending) — the board renders the honest empty state
  until events flow. (hanzoai/cloud PR #62.)
- Verification: `tsc --noEmit` clean; `npm test` **1012/1012** (84 files; +12
  admin-compute fold/tree/normalize/kind-filter, +1 admin-aggregate compute head);
  `next build` ✓. cloud: `gofmt` clean, `go build ./...` green, `go test ./clients/admin`
  ok. Authenticated visual e2e (both boards as a global admin) is post-deploy; renders
  the honest empty state today (no emitter). Not merged to main / no version bump — the
  merge/release step bumps `package.json` + tags the image.

## Native ERP / CMS / Analytics + real Commerce + resilient fetch (v8.4.33)

(v8.4.32 built the native-apps set below off b647d98; v8.4.33 is the deployed superset —
same native apps PLUS the shared-fetch transient-retry, one build.)

- **Resilient shared fetch — backend rolls are INVISIBLE to customers.** Root cause of a
  real "Could not load — Upstream service is unavailable" (Dave/maxpower on the Models
  catalog): cloud is single-replica `Recreate`, so a deploy-roll has a brief downtime
  window; a read that lands in it got a 502/503/504 and the console dumped the user on a
  scary manual-Retry card. Fixed in the ONE shared fetch (`client.ts` `authedFetch` →
  the pure, injectable `resilientFetch`) that BOTH the casibase-envelope (`request`) and
  plain-REST (`restRequest`) paths flow through — so it covers EVERY client fetch (Models,
  Overview, Billing, CRM, CMS, ERP, commerce, analytics, agents, prompts, …). A TRANSIENT
  upstream error (502/503/504 or a network connection error) on an IDEMPOTENT read
  (GET/HEAD) auto-retries with a short exponential backoff (`RETRY_BACKOFF_MS`
  300→900→2000ms, up to 3 retries) BEFORE surfacing the honest "Could not load" card — so
  a momentary roll self-heals and the card shows ONLY on a persistent outage. A genuine
  4xx (401/403/404/402) is NOT retried (honest state immediately, per the existing
  mapping); a MUTATION (POST/PUT/PATCH/DELETE) is NOT auto-retried (a 5xx'd write may have
  applied — re-sending could double-create; the user retries manually); a caller-aborted
  request is honored, never retried. The 401 silent-refresh (v8.4.29) is preserved as the
  second orthogonal resilience, guarded against a refresh loop. +13 tests
  (`client-retry.test.ts`): the exact Models-catalog 503→200 self-heal, budget-exhaust →
  honest error, network-retry, 4xx/mutation no-retry, abort honored, 401 refresh no-loop.

## Native ERP / CMS / Analytics + real Commerce over canonical backends (v8.4.32 → shipped in v8.4.33)

Maximize NATIVE app coverage in the console — get ERP, Content (CMS), Analytics, and
Commerce to the same "native-in-console, per-org, one canonical way" bar CRM already
meets. Every surface binds to its REAL backend (contracts verified against the source
repos + live probes); no surface fabricates data. Per-app isolation matches each
backend's real tenancy model (RED-checkable).

- **Analytics — rebound to the FOUR routes the backend actually mounts.** The module
  had called NINE `/v1/analytics/*` endpoints; `cloud clients/analytics` mounts only
  `overview | timeseries | top | health` (analytics.go:95-98) with DIFFERENT response
  shapes — so 5 tabs 404'd and 2 mis-parsed. `analytics.ts` + `AnalyticsModule.tsx`
  rewritten to the real structs (`clients/analytics/query.go`): the **LLM lens is REAL
  live per-org data** (`hanzo.cloud_usage`, prod Hanzo Datastore `datastore.hanzo.svc:9000`),
  charted over time; the **web + commerce lenses render honest-empty via the backend
  `available` flag** (`hanzo.events`, until a collector emits) — never fabricated zeros.
  Dropped the fabricated **Real-Time tab** (no realtime backend exists). Tabs: Overview
  (LLM KPIs + spend-over-time + honest web/commerce lenses) + LLM (top models table +
  donut). Range grammar `24h|7d|30d`. Responses are BARE JSON (not the casibase
  envelope) → plain `restGet`.
- **Content (CMS) — native Collections + Media/DAM ALONGSIDE the Studio embed.** New
  `/cms` user-bearer proxy (`app/cms/[...path]`) forwards the caller's minted IAM Bearer
  to `cms.<brand>` (SSRF-clamped via `clampedBrandDomain`); Payload's `hanzoIAMStrategy`
  verifies it (JWKS, issuer hanzo.id, audience unchecked) and its multi-tenant plugin
  scopes `pages`/`media` to the token `owner` claim → **each org reads ONLY its own
  content (per-org isolation BACKEND-enforced)**. `allowCmsSurface` admits ONLY the two
  tenant-scoped collections (list) + the per-file media bytes route, and REFUSES
  `api/users`/`api/tenants` (the non-tenant-scoped registry). `CmsModule` is now tabbed:
  **Collections** (native pages) + **Media** (native DAM grid; `<img>` bytes stream
  through `/cms/api/media/file/<f>`, never the cross-origin auth-required `media.url`) +
  **Studio** (the entitlement-gated admin embed, unchanged). `cms.ts` `CmsApi`.
- **ERP — real deploy + native Frappe summaries + desk embed, entitlement-gated.** ERP
  is a SINGLE shared per-brand Frappe instance (`erp.<brand>` is 502 today, no per-org
  provisioning), so the module + the new `/erp` proxy are **entitlement-gated to the
  owning brand org / a global admin** (a customer org gets the honest provision panel —
  never the brand's ERP data; Frappe is single-tenant). Overview drives a **REAL
  `/v1/platform` deploy** (`ErpApi.deploy` → idempotent create-project + create-app
  {source:image, `frappe/erpnext:v15.62.0`} + deploy, live status from `PaasApi`).
  Accounting / Items / Sales are **NATIVE Frappe REST summary views** (`/erp/api/
  resource/<DocType>`, real erpnext-v15 field sets) — honest "deploy ERP" until an
  instance answers, real rows the moment it does. `/erp` proxy: SSRF-clamped, read-only
  `api/resource/<DocType>` allow-list (`allowErpSurface`), Frappe `token key:secret`
  auth via server-only `ERP_API_TOKEN` (Frappe rejects an IAM Bearer). Desk embeds the
  real desk once reachable. `erp.ts` `ErpApi`.
- **Commerce — Products full CRUD + real store settings.** Products is now create +
  list + **delete** over `/v1/product` (validator needs name+sku+slug — auto-slugified);
  Store settings reads the org's REAL storefront (`/v1/store/current`,
  `CommerceApi.currentStore`). Orders/Customers/Inventory/Promotions stay real per-org
  reads on the shared `CommerceResource`. All via the `/commerce` bearer proxy (org from
  the token owner; per-org SQLite). Kind-names verified live (product/order/user=
  customers/variant=inventory/discount=promotions/store — `customer`/`inventory`/
  `checkout` are 404, the console correctly avoids them). hanzoai/commerce is the ONE
  authority (Go, per-org SQLite) — NOT Medusa.
- **GPUs KPI reconciled** (drive-by): the customer GPU KPI counted distinct MODELS (6)
  but the catalog table + Launch drawer list all CONFIGS (9). KPI now shows the
  launchable-config count (matches both) with the model count in the sub — both real
  from the one live visor catalog.
- **Isolation model (RED):** CMS is genuinely per-org (Payload isolates by owner claim →
  every org reads its own, no entitlement gate needed, registry collections refused);
  ERP + Help are single-tenant Frappe → brand-org/global-admin entitlement gate (a
  customer never reads brand data); Commerce is per-org (commerce EdgeAuth owner scope).
- Verification: `tsc --noEmit` clean; `vitest` **1050/1050** (88 files; +22 new:
  7 analytics, 6 cms, 5 erp normalizers, +2 cms/+2 erp proxy-allow); `next build` ✓
  (`/cms` + `/erp` routes registered). Built off origin/main HEAD (rebased onto the
  ServiceMesh/Edge lane), one patch above main → **v8.4.32**. Live visual e2e +
  per-org RED isolation checks are post-deploy.

## P0 fetch-binding fix + live-shape corrections + Playground multi-image/image-only (v8.4.34)

v8.4.33 shipped a REGRESSION my mocked tests hid; live verification (RENDERING the app,
not just probing APIs) caught it. This patch fixes it, corrects two live-shape bugs the
same live pass surfaced, folds in RED's LOW-1, and lands the two Playground fixes.

- **[P0 — CRITICAL, the whole API layer] "Illegal invocation" on every fetch.** The
  v8.4.33 `resilientFetch` refactor called `deps.doFetch(url,init)` — a METHOD call → the
  browser global `fetch` ran with `this=deps` and threw *"Failed to execute 'fetch' on
  'Window': Illegal invocation"* on EVERY cloud/BFF call (Analytics/Models/CRM/CMS/… all
  "Could not reach the backend"). The `client-retry` unit tests passed because they injected
  a MOCK `doFetch` (a plain fn with no `this` requirement) — the exact class of bug a mock
  hides. Fix (`client.ts`): destructure `const doFetch = deps.doFetch` + call it BARE
  (`doFetch(url,init)`, this=undefined) — works for a raw global `fetch` AND a wrapped one.
  **New regression test** simulates a global-only fetch (throws unless `this` is the global)
  and asserts resilientFetch invokes it bare — would have RED-failed the v8.4.33 wiring.
  Rolled the live console back to v8.4.31 the moment it was caught (function restored in ~1
  min), fixed forward here. LESSON: a shared-fetch refactor MUST be verified by RENDERING a
  data page live, not only by unit tests with a mocked fetch.
- **[live-shape] CMS numeric ids + prefixed media url.** Live prod pages/media use Payload's
  SQLite INTEGER ids (`{"id":3}`) — `normalizePage/Media` read them as strings so ids became
  `''` (rowKey collisions). Fixed with a number-aware `idStr`. And the media bytes url carries
  a `?prefix=<tenant>` query my filename-reconstruction dropped → new `cmsMediaSrc` proxies the
  doc's REAL `url` (path+query) through `/cms` (never the cross-origin host). +5 cms tests.
- **[live-shape] Commerce store settings.** `/v1/store/current` wraps the record as
  `{ store: {...} }` (verified live) — `currentStore` now unwraps `.store` before normalizing
  (a bare object still works), so the Store-settings page shows the real name/currency.
- **[RED LOW-1] `/erp` allow-list pinned to the 3 UI DocTypes.** Was any `api/resource/
  <DocType>`; now EXACTLY `{Account, Item, "Sales Order"}` (`ERP_DOCTYPES`), so an entitled
  brand member can't `GET /api/resource/User`/`Salary Slip`/`OAuth Bearer Token` through the
  shared `ERP_API_TOKEN` (a brand-internal over-read once ERP ships). RED verdict on v8.4.33:
  **0 critical/high/med, 1 low (this), 2 info; cross-tenant isolation SOUND across CMS/ERP/
  Help/Analytics — SHIP.** (INFO-1 host-from-config + INFO-2 audience-scoped bearer are
  deploy-config follow-ups, non-leaking.)
- **[Playground] Multi-image upload.** The composer held a SINGLE `attachment`; now
  `attachments: Attachment[]` (`useComposer`) with `addAttachments` (APPEND — a multi-select
  dialog OR successive uploads/drag-drops accumulate, never replace) + per-image
  `removeAttachment`. `Composer.tsx`: the file input is `multiple`, `onFile` reads EVERY
  selected image to a data URL in parallel, drag-drop of several is wired, and a thumbnail
  strip shows each image with a count + an individual remove (×). `compose.ts` `imageUrl` →
  `imageUrls[]`; `buildRunMessages` pushes ONE `image_url` part per image on the last user
  turn (OpenAI multimodal allows several).
- **[Playground] "Run does nothing" (image-only) + visible block reasons.** `validateRun`
  now counts an attached image as user content — an IMAGE-ONLY vision prompt is valid (content
  = just the image parts) and Run proceeds; it blocks ONLY a genuinely-empty message (no text
  AND no image) with a clear "Enter a message or attach an image to run." And that reason now
  renders PROMINENTLY (a red bordered notice with an icon) right above the Run button inside
  the Composer — hitting Run is never a silent no-op. (`VisionPlayground` — a separate
  URL-input surface — is untouched.) +10 compose tests (multi-image, image-only, blank-image
  filter, the new validation messages).
- Verification: `tsc --noEmit` clean; `vitest` **1076/1076** (89 files); `next build` ✓.
  Built off origin/main (my v8.4.33 work + the machines lane #57 already in main; one patch
  above → **v8.4.34**, tagged for a cancel-immune build). LIVE re-verify (a data page RENDERS
  real data — not just an API 200 — + attach 2-3 images → multi-image vision run + image-only
  Run works + block reason visible) is the required post-deploy gate this time.

## Inference endpoints dashboard + Status/Logs + shared per-product Metrics (v8.4.37)

The Inference page is redesigned to the "endpoints dashboard" mockup — wired to REAL
data everywhere, honest "—"/empty where a metric isn't exposed, NEVER the mockup's
placeholder figures (32.4K / 128ms / 99.95% / $1,286.42 / zen-3-32b rows are DESIGN
PLACEHOLDERS and appear nowhere). Sidebar + topbar untouched; only the Inference module
content + the SHARED sub-page Metrics view changed. Strictly @hanzo/gui v5 shorthands.

- **Real endpoints source (two, merged).** `src/lib/api/inference.ts` `InferenceApi`
  reads the org's DEPLOYED KServe InferenceServices from cloud `GET /v1/ml/models`
  (cloud `clients/ml`, per-org namespace `ml-<org>`) through the console's `app/v1`
  user-bearer BFF — NEW `ml` head in `proxy-allow.ts` `CLOUD_HEADS`
  (same-origin `/v1/ml/*`, bearer minted, cookie-only
  403s). These are folded (`mergeEndpoints`, deployed wins) with the MANAGED model-serving
  catalog (`/v1/models` via the `/ai` proxy). The managed catalog is the POPULATED base
  (per-endpoint metrics match the ledger by model id); the deployed source is best-effort
  (403/404 when ML isn't routed just omits those rows). Honest empty ("No endpoints yet ·
  Deploy your first endpoint") when both are empty.
- **Per-endpoint metrics — REAL or honest "—".** Requests (24h) + trend sparkline = the REAL
  commerce usage ledger (`aimetrics` `perModelMap`/`endpointDailyRequests`) matched by model
  id (no rows → real 0; ledger absent → "—"). P95/uptime have NO per-endpoint source →
  honest "—". KServe status → honest phase via `deriveMlPhase` (reads `status.conditions`).
- **Layout.** Header + PURPLE "Deploy Endpoint" CTA → a REAL `POST /v1/ml/models` deploy form
  over the shared `DetailPane`. Hero "Connected to Hanzo Cloud" (honest managed copy + pure-SVG
  purple accent, white-labeled by `config.brandName`). Two-column: LEFT `EndpointsPanel`
  (search + status/type/sort over REAL options + list⇄grid + rich rows + pagination; row →
  detail pane); RIGHT rail (stacks on narrow) = Usage Overview (REAL `usageWindow` ledger totals
  + prior-period deltas + sparklines) + Quick Actions + Need help (REAL routes + mailto — no
  dead links).
- **Status + Logs = Inference-OWNED `:tab` views** (declared SPECIFIC subpages → router renders
  THESE not the shared sub-page; Metrics + Settings stay shared). Status = per-endpoint health
  board + "Connected to <brand>" real tally (uptime/P95 "—"). Logs = REAL recorded inference
  activity (ledger = one row per billed call: time · endpoint · level · message), filter by
  endpoint + level; honest "not connected"/"no activity" — never fabricated log lines.
- **Shared per-product Metrics → rich LivingOverview (DRY, EVERY product benefits).**
  `ProductMetricsView` renders the ONE `LivingOverview` over `productMetricsConfig` (4 KPIs
  Requests/Tokens/Spend/P95 with deltas+sparklines, usage+spend over time, 3 breakdown donuts
  top-models-by-tokens/requests-by-status/spend-by-model, recent-usage feed) — REAL commerce
  ledger scoped by `metadata.product`. inference/models/api/gateway read the WHOLE ledger (it
  IS entirely inference calls); every other product filters by tag (honest-empty until
  attributed). P95 honest "—" until o11y. Added `byStatus` + `product` filter to the usage
  adapter; projected `byModelTokens`+`byStatus` in `fromCloudUsage` (additive).
- Verification: `tsc --noEmit` clean; `vitest` **1130/1130** (94 files; +28: 20 inference logic,
  3 product-metrics, +byStatus/product-filter usage-adapter, +byModelTokens/byStatus adapters,
  +ml proxy-allow); `next build` ✓ (the `/[...slug]` catch-all renders Inference + `:tab`).
  Rebased on origin/main (v8.4.36, the nav-accordion + gpus lanes) → one patch above → **v8.4.37**.
  Live visual verification is the post-deploy gate.

## Base = the Bases manager (multi-base) + no competitor copy (v8.4.42)

Two Base fixes: the user was "stuck with a single base" and the copy named a
competitor. ROOT CAUSE (live-verified as maxpower): the `base` product was a
"Supabase-style content-type dashboard" pointed at `/superbase/v1/collections` —
which is the SuperBase ORCHESTRATOR's OWN Base (base.hanzo.ai). So the "content
types" it listed were the orchestrator's control-plane collections
(`contacts`/`tenants`/`users`, with `_orgs`/`_superusers` filtered out) — one
shared Base, no way to make another. The REAL Bases registry is the `tenants`
collection (each row = a Base instance on its own `<slug>.base.hanzo.ai`; live it
holds e.g. "Acme CRM Test", slug `acme-crm-test`, spec `{replicas:3,storage:10Gi}`).

- **Base is now the Bases INSTANCE manager (the multi-base fix).** `BasesManager`
  (`components/products/base/BasesManager.tsx`) over the real tenants API: `''` =
  the org's Bases list + **New Base**, `new` = create (name → auto-slug + a size
  preset → `POST /v1/collections/tenants/records`), `:base` = configure one
  (edit name/size, live provisioning status, open its subdomain, delete). ONE Base
  binding — console2's `/superbase` proxy (mints the user IAM bearer, stamps
  `X-Org-Id` from the JWT owner — derive-once). `lib/base-data/tenants.ts`
  (`BaseTenantsApi` + `normalizeBase`, reuses the one `BaseDataApi` record client)
  + pure `base/bases-logic.ts` (slugify, validateBase, `SIZE_PRESETS`, `statusOf`,
  `baseHref`). Honest states everywhere (loading / `BackendStateCard` / empty
  "Create your first Base" / superuser+402 create gates → clear message). Registry
  routes `''|new|:base`; the shared subpage slugs (status/logs/metrics/settings)
  still take precedence over `:base` (match-core), so the sub-nav is unchanged.
- **Clean split from Records.** Base = manage Base INSTANCES; the sibling `Records`
  product browses a Base's DATA (collections + records) — the two no longer overlap.
  The superseded content-type dashboard (`BaseDashboard`/`CollectionBuilder`/
  `base/logic.ts` + tests) is removed (it was the confusing orchestrator-collections
  surface).
- **No competitor copy.** Dropped every "Supabase"/"Supabase-style"/"Firebase-like"
  string from the Base UI + docstrings and rewrote in Hanzo's own voice
  (`BaseModule` docstring, the registry `base` description, the new manager copy).
  Also removed `gcp: 'Firebase'` from the Base entry (it rendered "Equivalent to
  Firebase" on the Base surfaces). FLAGGED, not changed: the systematic `gcp:`
  field is a 29-entry cross-console GCP-equivalence feature (Vertex AI / Cloud Run /
  Cloud Storage / Firestore / "Firebase Hosting" on `apps` / …) used as a
  migration + search aid — stripping it globally is a separate product-wide call.
- **Backend flags (per-org isolation is a superbase concern, not console).** The
  `tenants` ListRule is `owner_iam_user = @request.auth.id` (per-user, not
  org-scoped) and the console's minted token appears over-privileged on
  base.hanzo.ai (a signed-in probe saw a foreign tenant + `_superusers`/`_orgs`).
  So true per-org isolation of the Bases list needs a backend fix (org-scoped
  ListRule + a non-superuser service identity + owner stamping). Separately,
  per-tenant DATA routing isn't wired (`/superbase` reaches the orchestrator, not
  `<slug>.base.hanzo.ai`), so a Base's own collections are managed in Records / its
  own dashboard once provisioned — the manager never fabricates per-tenant data.
- Verification: `tsc --noEmit` clean; `vitest` **1134/1134** (94 files; +14 bases-logic
  incl. normalizeBase, +1 proxy-allow tenants-by-id, −the deleted content-type logic
  tests); `next build` ✓. Live: the tenants API path is proven reachable (returned the
  real "Acme CRM Test" Base); the authenticated UI create+screenshot is the post-deploy
  gate. Rebased on origin/main (v8.4.41) → **v8.4.42**.

## Built-in assistant is a grounded Hanzo-suite expert across every chat surface (v8.4.43)

The console's built-in chat was a generic model chat — only ⌘K had a system prompt,
and that was a NAV-only mapping, not a knowledgeable assistant. This wave makes the
assistant a genuine expert on the WHOLE Hanzo suite, GROUNDED in real sources (the
product registry + docs RAG), never hallucinated — one shared prompt across all three
chat surfaces. Touches ONLY the assistant/chat surfaces (no registry/agents/overview
edits).

- **ONE grounded system prompt, DECOMPLECTED (`src/lib/assistant/`).** Split into a
  PURE builder (`prompt-content.ts` — no registry/React/config imports, unit-tested in
  isolation per the repo convention that `registry.tsx` is types-only in vitest because
  of its icon ESM) and a THIN registry-bound wrapper (`system-prompt.ts`). The prompt
  has three parts: (1) a curated, accurate **"what Hanzo is" overview** (Hanzo Cloud =
  build/ship AI software; the real product families — Zen models, Compute/GPUs,
  Data = Base+Vector+KV+SQL+…, Security = IAM+KMS, Dev, Platform/PaaS, Observe, Web3,
  Apps incl CRM/CMS/ERP/Chat, Commerce; the app surfaces beyond the console — hanzo.app
  web builder, Chat, Desktop, Extension; pay-as-you-go per-token pricing + real balances;
  how to navigate/deep-link) — written to what EXISTS, nothing invented; (2) the FULL
  product catalog **generated FROM the live registry** via `visibleCatalogByCategory`
  (the SAME gate the nav uses) — every product's label, one-line description, GCP analog,
  and in-console deep-link (`/id`), grouped by category with the registry's own
  `CATEGORY_SUMMARY` headers — so it is complete, stays current on its own, is
  white-labeled per brand (`config.brandName`), and **omits admin-only surfaces for a
  customer** (never suggests a locked page); (3) a behavior contract: concise, accurate,
  deep-link real pages, defer to the live catalog for models/prices, and — critically —
  answer HONESTLY ("Hanzo doesn't have a video editor") rather than invent a product,
  feature, endpoint, price, or model. No secrets in the prompt (public catalog + product
  facts only).
- **Wired into ALL 3 chat surfaces (DRY, one source).** `ChatConversation` (which backs
  BOTH the floating bubble `FloatingChat` and the full `/chat` page) builds the prompt
  admin-scoped (`useIsGlobalAdmin`) and sends via `AiApi.ragChat` — so every turn is the
  expert prompt + docs retrieval. `CommandPalette` `>` "Ask AI" now uses
  `commandBarSystemPrompt` (the SAME expert prompt + the `NAV <id>` contract appended, so
  ⌘K both jumps to a product on a clear intent AND answers knowledgeably otherwise —
  replacing the old nav-only prompt); the `?` docs mode is grounded with the same expert
  system prompt too. The catalog is derived ONCE (the command-bar variant is just base +
  nav directive). Suggested-prompt chips reseeded to the assistant's real domain
  ("How do I launch a GPU?", "What is Hanzo Base?", "How does pricing work?", "What AI
  models are available?").
- **Docs RAG grounding (best-effort, honest).** The chat requests `X-Retrieval` +
  `X-Retrieval-Store: docs` (`ASSISTANT_DOCS_STORE`, ONE store name shared with the ⌘K
  `?` mode). Server-side (`ai/controllers/chat_retrieval.go`) retrieval is relevance-based
  top-4 semantic search scoped to the caller's org and **degrades to a plain answer on any
  failure / empty store** — so the assistant is fully versed from the registry-derived
  prompt whether or not a docs store is indexed for the org. `AiApi.ragChat` extended with
  optional `history` (2-line, backward-compatible — the assistant's own binding) so the
  grounded chat keeps multi-turn context. Whether the `docs` store returns real
  docs.hanzo.ai content is a per-org indexing question verified post-deploy; if empty it's
  a RAG follow-up, not a regression.
- Verification: `tsc --noEmit` clean; `npm test` **1142/1142** (95 files; +10
  prompt-content builder tests: overview facts + brand white-label + entry/opensAt
  formatting + catalog generation + honest-boundary + NAV-superset + no-secrets);
  `next build` ✓ Compiled successfully. Rebased on origin/main (v8.4.42, the Bases-manager
  lane) → one patch above → **v8.4.43**. Idiom: @hanzo/gui v5 shorthands; sidebar/header
  untouched. Live Q&A verification (bubble + full chat + ⌘K, incl. an honest "no such
  feature" answer) is the post-deploy gate.

## Shared per-product Status/Logs/Metrics/Settings — correct, per-product, DRY (v8.4.45)

The uniform base sub-pages (Overview · Status · Logs · Metrics · Settings) are made
REAL, correct, and per-product across EVERY product, driven by ONE metadata-driven
system — no bespoke-per-product pages, no fabrication. Only the shared subpage system
(`components/products/subpage/*`), the native-overview specs (`overview/*`), and the
living-overview metrics config (`overview/living/*`) + per-product metadata are touched.

- **Metrics scoped PER PRODUCT + one metadata source (DRY).** The Metrics dashboard
  already filtered the usage ledger by `metadata.product === <id>` (`usage-adapter.
  buildCloudUsageOverview`), but the "which products are the inference surface" decision
  was DUPLICATED — a DEAD `MetricsFeed`/`O11Y_METRICS_PRODUCTS` set in `subpage/sources.ts`
  (ignored by the view) AND the live `RAW_INFERENCE_PRODUCTS` in `product-metrics.ts`.
  Consolidated to ONE place: `sources.ts` `metricsScopeFor(id)` →
  `{ product, scope }` — `INFERENCE_SURFACE_PRODUCTS = {inference,models,api,gateway}`
  read the WHOLE inference ledger (`product:null`, `scope:'inference-all'`), every OTHER
  product filters by its own tag (`product:id`, `scope:'product'`, honest-empty until
  attributed — NEVER the org total). `product-metrics.ts` + `ProductMetricsView` consume
  it. **Audit-proofing:** the 4 inference-surface products (whose ledger genuinely IS the
  whole inference ledger — every call flows through them) now carry an explicit honest
  banner ("This is your org's whole inference ledger — every model call flows through
  <label>. Higher-level products show only their own attributed usage.") + a scope-aware
  subtitle, so the whole-ledger view is TRUTHFULLY LABELED, never masquerading as a narrow
  per-product slice or an org-aggregate leak.
- **Status/Logs service accuracy (grounded in the live `/v1/apps`).** Probed the real
  operator inventory (108 apps): the derived service name (`repoBase(repo) ?? id`) was
  WRONG for a few products, so Status/Logs showed a false "not deployed" for services that
  ARE running. Added a verified `SERVICE_OVERRIDE` in `sources.ts` — `models` (repo
  `hanzoai/ai` derived `ai`; the real operator app is `models`), `bot`→`bot-gateway`,
  `helpdesk`→`help` — each maps to a service that genuinely appears in `/v1/apps`, so
  Status lights up REAL health. Fixed the stale `console` spec health service
  (`console2`→`console`, the canonical operator app). gateway/dns/kms/metrics/s3 are
  raw-deployed (NOT operator apps) → they correctly show an honest "not reporting", and the
  Status/Overview "no service" copy was made neutral+honest ("operator inventory reports no
  running <label>… may be a shared managed service reported elsewhere… no status is
  fabricated") instead of a misleading "Provision it". Platform `/v1/logs` rejects even the
  service token, so Logs resolves to a Logs-specific honest "managed by Hanzo" card (never
  fabricated lines).
- **Settings is product-specific + REAL (not a dead generic form).** `settingsConfigFor
  (entry)` (`sources.ts`) surfaces each product's real configuration — REUSING the product's
  native-overview spec facts+actions verbatim where one exists (DRY, one content source:
  gateway/api/cli/… Base URL/Auth/endpoint + Create-API-key), else a category-appropriate
  honest config (AI → `api.hanzo.ai/v1` + Bearer + Manage-API-keys; data resources →
  connection pointer + the product's own page; Security → managed; default → the product's
  own page). `ProductSettingsView` renders a NEW **Configuration** card (real facts +
  real in-console links) above About/Deployment/Org — every value real or an honest "—".
- **Overview customized for ALL.** The 12 native-overview products all carry rich bespoke
  `OVERVIEW_SPECS` (verified by `resolve.test`); `defaultSpec` stays honest (real
  category/repo facts, NO fabricated actions/health). The `console` spec health repointed to
  the real app. Products with their own overview module (Inference/Models/Functions/GPUs/
  Vector/…) are untouched (other lanes) — their Status/Logs/Metrics/Settings ARE this shared
  system.
- DRY + honest by construction; strictly @hanzo/gui v5 shorthands, mobile-responsive
  (flexWrap rows). Did NOT touch `AgentsModule`/`agents/*` or `assistant/*`.
- Verification: `tsc --noEmit` clean; `vitest` **1140/1140** (94 files; +10: metricsScopeFor
  scope/consolidation, SERVICE_OVERRIDE, settingsConfigFor reuse+category defaults, honest
  inference-surface framing); `next build` ✓ (all routes). Rebased on origin/main (v8.4.44)
  → **v8.4.45**. Live authenticated spot-check (Models/Inference/Functions/GPUs/Vector/
  Gateway/IAM/Commerce) is the post-deploy gate.

## Base copy follow-up — last competitor name out of the assistant prompt (v8.4.46)

A whole-repo sweep after v8.4.42 caught the ONE remaining user-facing competitor
reference to Base: the built-in AI assistant's system prompt (`src/lib/assistant/
prompt-content.ts`) described Base as "a **Firebase-style** backend" (introduced by
the v8.4.43 grounded-assistant lane). Rewritten in Hanzo's own voice — "a realtime
backend — spin up per-org Bases with content types, records, and auth" — so the
assistant never names a competitor when describing Base. The console is now fully
free of Supabase/Firebase user-facing copy (the systematic `gcp:` GCP-equivalence
field remains, flagged separately as a cross-console migration/discovery feature).

- Drive-by (restores main to green): `overview/living/open-edition.test.ts` (the #60
  Open Edition lane) used the OLD vitest `vi.fn<[Args], Return>()` two-type-arg form,
  which the pinned vitest v3.2.4 rejects — main's `tsc --noEmit` was RED. Migrated to
  the v3 single-function-type form `vi.fn<(p?: UsageOverviewParams) => Promise<…>>()`.
- Verification: `tsc --noEmit` clean; `vitest` **1163/1163** (96 files); `next build` ✓.
  Rebased on origin/main (v8.4.45) → **v8.4.46**.

## Observe · Logs + trace-search wired to the live o11y (O11y) runtime (v8.4.62)

Fills the LAST o11y query gap the console had. o11y (O11y) was already consumed
by **Service Map** (RED metrics + dependency graph, `ApmApi.services/dependencies/
topOperations`) and **Alerts** (`o11y/v1/rules`) over the same-origin `/v1`
bearer proxy (`cloudProxyV1Url('o11y/…')` → cloud reverse-proxies `/v1/o11y/*` →
the o11y runtime's `/api/*`). The two O11y signals `apm.ts` was MISSING —
application **LOGS** and **trace search** — are both the composite `POST /api/v3/
query_range` (the deployed `GET /api/v1/logs` is a hardcoded stub returning
`{"results":[]}`; `query_range` is the one true read the O11y explorer itself
issues). Added there (DRY — ONE o11y client), NOT a second o11y path.

- **`lib/api/apm.ts` gains `logs()` + `traceSearch()`** over `POST o11y/v3/
  query_range` with the exact `list`-panel `noop` builder query (`listQueryPayload`,
  verified against the O11y frontend payload + the server `BuilderQuery` struct,
  so the runtime never 400s), plus pure, defensive parsers: `parseListRows` (reads
  `data.result[].list` AND the `data.newResult.data.result[].list` mirror), `toIso`
  (collapses O11y ns/us/ms/s epochs → ISO), `normalizeLogRow`/`normalizeLogs`
  ({id,timestamp,severity,service,body}) and `normalizeTraceSpan`/`normalizeSpans`
  ({id,traceId,name,service,durationNano,status}). Time = epoch MS (`ApmWindow.
  startMs/endMs`), the v3 unit. Every column-name variant tolerated; empty result →
  honest empty list (never a throw), garbage → [].
- **`LogsModule` is now two real lenses, one product.** DEFAULT **Application logs**
  = live o11y logs via `ApmApi.logs(apmWindow(range), 500)` — real lines
  (time · severity · service · message), org-scoped by the minted bearer, range
  toggle (15m/1h/6h/24h) + severity/service filters. Honest states: loading, the
  shared o11y `RuntimeNotice` on 503/404/401/403, and an honest "Connected · no
  application logs in the last <range>" empty card (o11y answered, no OTLP logs
  ingested for the org yet — says WHY, points at AI Metrics; never a fabricated
  grid). Second lens **Request activity** = the prior commerce-usage-ledger
  per-request log, kept intact as the always-real fallback. So Logs NEVER regresses
  and GAINS real platform-log search.
- **Traces/Observations/Metrics unchanged (correct-domain decision).** Traces +
  Observations stay on `/v1/evals` — the LLM/agent trace + generation domain
  (cost/tokens/scores), which raw OTel spans lack; repointing them would regress.
  Metrics stays on VictoriaMetrics (real infra metrics). `ApmApi.traceSearch`
  exposes the o11y APM span-search signal for a future APM-traces view without
  fabricating one. Alerts left as-is (same established `o11y/v1/*` convention).
- **One canonical Observe surface** — the registry already routes every Observe
  product to a native module (no `o11y.hanzo.ai` link-outs); o11y.hanzo.ai is the
  raw O11y backend, console is the product UI. Unchanged.
- **Reachability (flagged, honest):** the o11y wiring uses the IDENTICAL transport +
  path convention as the already-shipped ServiceMap/Alerts clients, so it lights up
  with real data exactly when they do — iff the cloud→o11y `/v1/o11y/*` reverse-proxy
  resolves end-to-end (the deployed 0.2.0 pod serves bare `/api/*`; the pod's
  `global::external_url` must be `/v1/o11y` for the verbatim forward to strip to
  `/api/*`) AND OTLP logs are ingested for the org. Until then the lens shows the
  honest o11y `RuntimeNotice`/empty state, never fabricated data — and Request
  activity stays real. Not a regression I introduced; shared with ServiceMap/Alerts.
- Verification: `tsc --noEmit` clean (0 errors); `vitest` **1373/1373** (112 files;
  +13 apm: listQueryPayload shape/clamp, parseListRows both locations + garbage,
  toIso ns/us/ms/s/ISO, normalizeLogRow/normalizeLogs, normalizeTraceSpan/
  normalizeSpans); `next build` ✓ Compiled successfully (the `/[...slug]` catch-all
  that renders LogsModule). Authenticated visual e2e is post-deploy (the (dashboard)
  group is behind AuthGate). Rebased on origin/main (v8.4.61) → **v8.4.62**.

## Native CMS — complete over the Framework DocType engine, Payload-parity WYSIWYG (v8.4.67)

The CMS is finished and native: every `/cms/*` URL renders the DocType renderer over
`/v1/framework/*` (no iframe, no raw JSON, no 404). ROOT CAUSE of the live
`console.hanzo.ai/cms/collections/Article` → `{"error":"Not found"}` bug: the
deployed image (v8.4.65) lacked the wired CMS sub-routes, so the catch-all resolved
`['cms','collections','Article']` to `notfound` and a Next RSC navigation to
`notFound()` serves a JSON 404. The routes were already declared correctly on the
CMS branch (`collections/:doctype`, `collections/:doctype/:name` → `CmsModule`);
this release completes + ships them.

- **Rich-text = Payload Lexical, native.** `@hanzo/data`'s field registry already has
  a `richText` type stubbed to a plain textarea. A fresh, thin Lexical WYSIWYG
  (`src/components/fields/RichTextEditor.tsx` + `RichTextField.tsx`, built on core
  `lexical@0.46.0` + `@lexical/{react,rich-text,list,link,html,selection,utils}` —
  the same primitives Payload's MIT `richtext-lexical` uses, NOT its Payload-coupled
  field) is registered over `richText` in `Provider.tsx` (right after
  `registerDefaultFields()` — `registerField('richText', …)` overrides in place, no
  fork). Toolbar: bold/italic/underline, H1/H2/H3 + paragraph + quote, bullet/number
  lists, links, undo/redo. Stored value = the Lexical `EditorState` JSON string; read
  view renders it to sanitized HTML via `$generateHtmlFromNodes`. Pure serialization
  (`richtext-serialize.ts`) round-trips + defensively migrates a legacy plain-`Text`
  body (wrapped in one paragraph, never throws). A DocType field typed `RichText`
  (`types.ts` `Fieldtype` + `fields.ts` `TYPE_MAP` → `richText`) renders it.
- **RichText fieldtype in cloud** (v1.786.52+): `clients/framework` accepts a
  `RichText` fieldtype (const + validated allow-set + `coerceField` string
  passthrough — 5 lines, schemaless blob, round-trips verbatim), and the seeded CMS
  `body` (Article/Page/Post) is now `RichText`. Cloud change shipped via cloud `main`
  → arcd release build.
- **Content-type builder** (`CollectionBuilder.tsx` + pure `builder-logic.ts`): "New
  collection" defines a DocType's name + typed fields ON-PAGE — add/remove/reorder/
  require/show-in-list, every framework fieldtype (Text/RichText/LongText/Number/
  Decimal/Currency/Checkbox/Date/Datetime/Select/Relation/Attachment/Table/JSON) with
  the extra inputs each needs (Select options, Relation target). Auto-derives
  autoname/titleField from slug+title.
- **Media = real DAM** (`MediaGrid.tsx` + `media-upload.ts`): drag/drop or pick →
  uploads to the org's own S3 (`cms-media` bucket, via the SAME `/v1/s3` SeaweedFS
  presigned-PUT the Storage product uses) → creates a Media doc with the STABLE
  object key (`s3://…`, since object URLs are 5-min TTL) → thumbnails presigned
  on-view. Delete removes doc + object. Per-org by the bearer.
- **Publish flow**: `DocTypeDetail` Publish/Unpublish (the `status` Select), plus
  Submit/Cancel for submittable types.
- **Project scope (one engine, project as filter)**: the console's org→project
  `ScopeSwitcher` drives the CMS — a selected project filters the records list
  (`?filters={"project":…}`) and is stamped onto new records, but ONLY on collections
  that declare a `project` field (honest; the engine 400s a filter on an unknown
  field). Seeded content + builder starters include an optional `project` Data field.
  NO per-project/per-org CMS instances.
- Verification: `tsc` clean, `vitest` **1418 pass** (+ richtext-serialize/builder-
  logic/media-upload/fields project+richText/framework RichText round-trip), `next
  build` ✓ 14/14. Live e2e as Dave post-deploy. Cruft: the old minimal name-only
  "New collection" form + `contentCollection` helper are replaced by the builder;
  the dead `src/lib/api/cms.ts` (old /v1/cms iframe client) was already removed.
  Rebased on origin/main → **v8.4.67**.

## CMS routing fix — framework/s3 clients use the /cloud proxy (v8.4.70)

The v8.4.67 CMS shipped but every framework call 403'd for a real user whose org HAS
the cms module — the "Not enabled" card. ROOT CAUSE: the framework + storage clients
addressed a bare `/v1/framework` / `/v1/s3`, but console.hanzo.ai's INGRESS routes
`/v1/*` to hanzoai/gateway (bypassing Next), so the next.config `/v1/<head> → /cloud`
rewrite never runs and the gateway 403s (no principal). FIX (v8.4.70): the
framework/client.ts + api/storage.ts build URLs with `cloudProxyV1Url` →
`/v1/...` (re-added to api/client.ts; the /v1-canonicalization had deleted it).
The `/v1` route reaches app/v1's bearer proxy, which mints a user-bound token
and forwards with the org from the token owner. Fixes CMS + ERP + Help (all use
FrameworkApi) + the S3 product + the CMS media DAM in ONE class-fix. VERIFIED LIVE as
Dave (maxpower): all 6 collections render, the content-type builder + Lexical WYSIWYG
work, a record was created→published (status=Published, body=Lexical JSON), read-mode
renders the rich HTML. Needs cloud with the RichText fieldtype (v1.786.56; see prior
section — the release path had minted phantom tags, retagged the boot-verified
sha-d529c6f).

KNOWN INFRA GAP (not CMS): the media DAM's S3 object PUT returns 500 InternalError
from s3.hanzo.ai (MinIO/SeaweedFS backend) — bucket-create + presign + Media-doc-create
all work (200/201), only the object WRITE fails, backend-wide (a fresh bucket 500s
too). The DAM code is correct up to the storage boundary; the S3 write path is a
separate infra defect.

## Restore main to green + lock two contracts — overview/models ship (v8.4.72)

Two live CTO reports (overview blank/errored when authed; Qwen/Llama/DeepSeek model
icons blank). BOTH were the STALE deployed image: main couldn't ship because the
v8.4.70 build was broken — `framework/client.ts` + `storage.ts` imported the
`cloudProxyV1Url` that PR #81 had DELETED (`tsc` TS2305 "no exported member"), and
`next build` type-checks (no `ignoreBuildErrors`), so CI produced no new image. The
overview's own code is sound (`UsageApi.overview` → `/v1/billing/usage`; the
`LivingOverview` driver degrades to an honest `ErrorState`, never a hard blank), and
the brand entries already landed in `6dfa9c059` (Qwen `#615CED`, Meta `#0866FF`,
DeepSeek `#4D6BFE`; `families.ts` maps them; live pricing.json providers are clean) —
they just couldn't deploy.

- **Build fix = concurrent `c458efa8f`** (deferred to; it has prod-ingress
  knowledge): re-add `cloudProxyV1Url` — the PROD-CORRECT variant. The live Traefik
  ingress does NOT rewrite bare `/v1/s3` / `/v1/framework` to the console app (they
  reach hanzoai/gateway with no principal → 403), so those two heads MUST address the
  `/v1` user-bearer proxy EXPLICITLY. (A naive repoint to bare `/v1/` — the
  "canonical" form — would 403 live; NOT done.)
- **But that left `vitest` RED** (its own oversight): `canonical-paths.test.ts` still
  asserted the OLD prefix-free `StorageApi.buckets → /v1/s3/buckets` (#81), which now
  returns `/v1/s3/buckets`. Reconciled: dropped the stale prefix-free `s3`
  assertion; added a DOCUMENTED `cloud-proxy exceptions` block pinning
  `StorageApi.buckets → /v1/s3/buckets` + `FrameworkApi.doctypes.list →
  /v1/framework/doctypes`, so a future "canonicalization" can't repoint them to
  a bare `/v1/` that 403s in prod.
- **families ↔ brand lock (the models guard):** every curated family's `logo`
  (rendered by `<ProviderLogo>` on every header + row) MUST resolve through the ONE
  `normalizeBrand`→`BRANDS` resolver to a real colour + icon — keyed off the EXACT
  live pricing.json provider strings ("Qwen"/"Meta"/"DeepSeek"). This is the permanent
  guard for the CTO's "icons blank" report; the entries exist, this locks them so the
  class can't recur (a family added with an unresolvable logo now fails the suite).
- Test-only diff (2 files, +75/−6) — the runtime fixes are already on main; this cuts
  the green release. Verification: `tsc --noEmit` 0; `vitest` **1507/1507** (121
  files); `next build` ✓ 14/14. Rebased on origin/main (v8.4.71) → **v8.4.72**.

## Playground catalog 502 → resilient + promoted-Zen default (v8.4.73)

Live bug (CTO screenshot): `console.hanzo.ai/playground` → "Could not reach the
backend — HTTP 502" with the model selector empty ("Choose a model"), Run blocked.
ROOT CAUSE: the ChatPlayground catalog fetch (`aicatalog.fetchCatalog`, via
`useModels`) hard-depended on the rich pricing catalog `/v1/pricing/models` — that
endpoint 502s on the live ingress, and its `restGet` had **no `.catch`**, so the
whole `Promise.all` rejected even though `/v1/models` (200, the full ~59-model DO-first
catalog incl the zen5 family) succeeded right beside it. The working `/v1/models`
result was discarded → 502 error card → no model preselected → Run disabled.

- **Fix 1 — repoint to the WORKING `/v1/models` (catalog reachability, DRY).**
  `fetchCatalog` now treats `/v1/models` (the live routing set) as the PRIMARY,
  always-routed source and `/v1/pricing/models` as a BEST-EFFORT overlay — the EXACT
  resilience `CloudModelApi.list` already uses (models primary + `fetchPricing` catch).
  When pricing 502s it falls through to the live set (each entry normalized name←id,
  provider←owned_by so the picker row is never blank — also fixes a pre-existing latent
  blank-name for live-only Zen models when pricing IS up); it throws ONLY if the live
  `/v1/models` set itself is unreachable. Marketplace + ModelCatalog (the other
  `fetchCatalog` consumers) get the same resilience for free.
- **Fix 2 — auto-select the latest PROMOTED Zen flagship as default.** New pure
  `default-model.ts` (`defaultModelId`, extracted from `useModels` so it's node-testable
  without the hook's UI imports — re-exported so callers are unchanged): (1) honor an
  explicit catalog promotion (`featured` — the "Editorially highlighted" flag) so the
  default AUTO-TRACKS whatever we promote next (a `featured` zen6) with no code change;
  (2) else the Zen flagship by name — newest major, bare family id (`zen5`) over a named
  tier (`zen5-pro`) over a sub-tier (`zen5-mini`/`-flash`/`-coder`); (3) else any
  servable text model, then the first entry. `ModelOption` carries `featured`. The
  ChatPlayground seed effect is now retry-safe (only "commits" once it actually seeds).
- Verification: `tsc --noEmit` clean; `vitest` **1518/1518** (+9 default-model,
  +2 aicatalog 502-resilience over v8.4.72's 1507). (The `canonical-paths.test.ts` s3
  case this branch had originally flagged as pre-existing-RED was fixed independently on
  main in v8.4.72 — the `/v1/s3` exception lock — so the suite is fully green here;
  `storage.ts`/`canonical-paths.test.ts`/`client.ts` untouched by this change.) `next
  build` ✓ 14/14. Authenticated Playground screenshot is post-deploy (the `(dashboard)`
  group is behind AuthGate); the two fixes are proven by the logic tests (repointed/
  resilient endpoint + promoted-Zen default). Rebased on origin/main (v8.4.72) → **v8.4.73**.

## admin.<brand> /v1/admin/* 403 → audience-scoped operator bearer (closes INFO-2)

THE LAST admin-cockpit gate. The operator logs in on admin.hanzo.ai (owner=admin,
isGlobalAdmin, cockpit renders), but EVERY `/v1/admin/*` returned 403 "global admin
required" from cloud. ROOT CAUSE (traced through cloud + IAM source, NOT the initial
guess): the admin-aggregate proxy forwards a user bearer minted by `issue-user-token`
for the resolved operator `admin/z`. That JWT's `owner` claim IS `admin` and `isAdmin`
IS true (both come from the TARGET user, `getUserWithoutThirdIdp`/`getShortUser` →
`Owner: user.Owner`), so the initial "owner=hanzo" diagnosis was a misattribution. The
real defect is the **audience**: `issue-user-token` defaults the JWT `aud` to the
target user's OWN app (`tokenAudience` → `application.ClientId`), and the reserved-admin
operator's app is `admin-console` — which is NOT in cloud's audience allowlist
(`defaultJWTAudiences` = hanzo-app/console/chat/id/cloud/cowork/https://api.hanzo.ai +
`BrandAudiences` = `<brand>-cloud`). cloud's `SanitizeIdentity` therefore REJECTS the
token entirely (`validatedPrincipal` → nil), the request resolves anonymous, no
`X-User-IsAdmin`, and `guard()` 403s. Tenant tokens never hit this because a tenant
user's home app (`hanzo-cloud`) already IS in the allowlist.

FIX — an audience-scoped bearer (the RFC 8707 `resource` `issue-user-token` already
accepts), host-aware, scoped ONLY to the admin path:
- `config/index.ts` `cloudAudience(host)` — the brand cloud audience `<brand>-cloud`,
  read off `BRANDS[brand].iamApp` (the ONE source). Correct EVEN on an admin host,
  where the LOGIN app switches to `admin-console` but the RESOURCE the forwarded bearer
  is presented to is still the brand cloud API. cloud's `BrandAudiences` bakes in every
  `<brand>-cloud` un-removably, so this audience is always trusted.
- `identity.ts` `issueUserToken(user, audience?)` passes `aud` when set; `adminBearer
  (user, audience?)` caches per `(user, audience)` (a token minted for one resource
  server's audience must never be handed to a proxy needing another).
- `bearer-proxy.ts` `BearerProxyOpts.audience?` → `adminBearer(user, opts.audience)`.
- `app/admin/aggregate/[...path]/route.ts` passes `audience: cloudAudience(host)`.
So the operator's forwarded `/v1/admin/*` bearer now carries `aud=<brand>-cloud`
(accepted) + `owner=admin` + `isAdmin=true` → cloud sets `X-User-IsAdmin=true` → 200.
The tenant proxies (`/v1`, `/ai`, `/vm`, …) omit `audience`, so they mint the
default (target-app) audience exactly as before — tenant owner/isAdmin/confidential
mint client (`hanzo-console`) all unchanged; no security change. This is the
"INFO-2 audience-scoped bearer" deploy-config follow-up flagged since v8.4.34, now a
code fix (no cloud change — the backend gate `global-admin = owner==adminOrg &&
isAdmin` is correct and untouched).

- Verification: `tsc --noEmit` clean; `vitest` **1603/1603** (128 files; +3 config
  `cloudAudience` incl. the admin-host-still-cloud-audience case, +3 identity
  issueUserToken/adminBearer aud + per-audience cache, +2 bearer-proxy admin-aggregate
  audience plumbing / tenant-unchanged); `next build` ✓ (`/admin/aggregate/[...path]`
  registered). Live 200 on `/v1/admin/overview` with a minted admin bearer is the
  post-deploy gate (the confidential mint creds live in the cluster secret, not the
  dev host — devs don't touch k8s directly). Branched off origin/main (v8.4.80).

## Per-product Status/Logs/Metrics wired to the LIVE o11y (O11y) runtime, one DRY mechanism (v8.4.74)

The shared per-product sub-page system (`components/products/subpage/*`, one
Status/Logs/Metrics/Settings for every `module` product — the catch-all routes every
base slug here, so ALL 136 products already had these four tabs) is now backed by the
LIVE o11y (O11y) runtime, scoped per product by its OpenTelemetry `service.name` —
via ONE mechanism parameterized per product, NOT bespoke wiring. Reuses the existing
`ApmApi` o11y client + the shared `RuntimeNotice` + the ONE `LivingOverview` — nothing
forked, nothing new-per-product. Adding a product still needs zero sub-page code.

- **The ONE new mapping — product → OTel `service.name` (`subpage/sources.ts`
  `o11yServiceFor`, pure + tested).** Derived from the OTel convention (service.name =
  the binary/repo basename: `iam`→iam, `vector`→vector, the AI products→`ai`, the
  Observe products→`o11y`, …), a tiny override (`bot`→`bot-gateway`), id as last resort;
  `null` for pure org/account + rollup products (no backing service → honest managed
  state). Carried as a new `o11yService` field on `subpageSourcesFor` — ONE source every
  sub-page view reads. Orthogonal to the operator-app `service` (deployment state): a
  product may emit telemetry under one name (`ai`) and deploy under another (`models`),
  so both are candidates when reading health. A wrong guess yields an honest EMPTY o11y
  state, never another service's telemetry (the reads exact-match the name).
- **The ONE new query capability — per-service o11y filtering (`lib/api/apm.ts`).**
  `listQueryPayload` gains an optional `filters` arg (default none → back-compat with the
  Observe Logs board + the existing tests); `serviceFilterItem(dataSource, service)`
  builds the exact O11y v3 `service.name` resource-attribute equality the explorer
  sends. `ApmApi.logs(w, limit, service?)` / `traceSearch(w, limit, service?)` scope the
  query to one product's service AND re-filter the rows client-side (a runtime that
  ignored the item can never leak another service's lines). `ApmApi.serviceHealth(w,
  ...candidates)` reads the org-scoped services list and picks the product's RED-metrics
  row (`pickService`) → a `ServiceHealth` verdict (`serviceHealthOf`: ns→ms latency,
  green/<1%/yellow/≥5%/red on error rate; `null` when the service reported no calls).
- **Status = LIVE o11y RED metrics + deployment state (two orthogonal sources).**
  `ProductStatusView` now leads with a real "is it serving traffic and healthy" band
  from `ApmApi.serviceHealth` (requests/s · error rate · p99 · request count) — org-scoped
  by the minted bearer, so it works for a CUSTOMER too (unlike the admin-only control-plane
  inventory), keeping the deployment workloads table for admins. Honest by construction:
  no o11y telemetry AND no deployment rows → the managed card; one source failing never
  blanks the other; never a fabricated green.
- **Logs = LIVE o11y logs filtered to the product's service.** `ProductLogsView` is
  rebuilt onto `ApmApi.logs(window, 500, o11yService)` — real OTLP→O11y log lines
  (time · severity · message) for THIS product, org-scoped, range toggle (15m/1h/6h/24h)
  + severity filter (reusing the Observe Logs board's pattern). Replaces the dead
  `/paas/logs` path (the platform log endpoint rejects even the service token). Honest
  states: the shared o11y `RuntimeNotice` on 503/404/401/403, and an honest "Connected ·
  no logs for <product> in the last <range>" empty card (the service ships no OTLP logs
  yet) — never a fabricated grid, never placeholder lines.
- **Metrics = REAL ledger + LIVE o11y latency (the P95 "—" filled).** The shared
  `productMetricsConfig` loader now fetches the commerce usage ledger AND
  `ApmApi.serviceHealth` in parallel and merges the real p99 into the latency KPI (the
  tile was stuck at "—" — the ledger carries no latency). Renamed `latencyP95`→
  `latencyP99` (honest to the RED metric we actually have). o11y failure / no-telemetry →
  the tile stays an honest "—"; the ledger half always resolves.
- **Settings unchanged** — already REAL, product-specific config (endpoint/auth/connection
  facts + deployment facts), honest where a product self-serves none.
- **Coverage:** all **136 products** route Status/Logs/Metrics/Settings through this ONE
  system (external launch tiles correctly get none). Every product with a backing service
  (its `o11yService` resolves — every `module` product except the 9 pure org/account +
  rollup ids) now has LIVE o11y Status + Logs + Metrics-latency wired; it shows REAL data
  the moment that service emits OTLP, and an honest empty/RuntimeNotice until then (never
  fabricated). The product→o11y-service map is repoBase-derived (the OTel convention),
  best-effort exact-match, correctable via the tiny `O11Y_SERVICE_OVERRIDE` as live o11y
  reveals a non-default `OTEL_SERVICE_NAME`.
- Verification: `tsc --noEmit` clean (0 errors); `vitest` **1545/1545** (124 files; +25:
  13 apm serviceFilterItem/pickService/serviceHealthOf/listQueryPayload-filter, 6
  apm-service-scope end-to-end query-builds-+-maps-real-response, 8 sources o11yServiceFor,
  3 product-metrics latency-injection, latencyP95→P99 rename); `next build` ✓ Compiled
  successfully (14/14 pages, the `/[...slug]` catch-all renders every product's sub-pages).
  o11y is LIVE (o11y.hanzo.ai/api/v2/readyz=200; `/v1/o11y` 403 unauth = the org-scoped
  gate). Authenticated visual e2e is post-deploy (the `(dashboard)` group is behind
  AuthGate); the per-product o11y query building + mapping real O11y responses is proven
  by the logic + end-to-end tests. Rebased on origin/main (v8.4.84) → **v8.4.85**.

## Zero customer-facing 404s — declare :tab routes for Containers/Finetuning/Tasks (v8.4.86)

Exhaustive authenticated crawl of console.hanzo.ai (as Dave/maxpower, a customer)
found the console's ONLY dead in-app links: three tabbed modules whose registry
entries dropped the `:tab` sub-route. Each renders its own tab bar
(`const go = (id) => router.push(`/<id>${id ? '/'+id : ''}`)`, reading
`params.tab`) but declared only `{ path: '' }`, so every tab 404'd:

- **Containers** — Pods/Containers/Images/Namespaces/Events (`/containers/<tab>`).
- **Fine-tuning** — Datasets/Checkpoints/Models (`/finetuning/<tab>`).
- **Tasks** — Schedules/Workers 404'd; Queues degraded to a placeholder stub
  (`queues` was a declared subpage, so it fell to the stub instead of 404).

Fix (registry data only, minimal): declare `{ path: ':tab', component: <Module> }`
on each. Tasks keeps its 2-segment `:ns/:wid` workflow-detail route — `:tab`
(1 seg) and `:ns/:wid` (2 seg) are unambiguous (matched by exact segment count).
The modules already read `params.tab`; nothing else changed. This is the same
class the CLAUDE.md notes have hit before (a module targeting a `:tab`/detail route
the registry never declared).

Also corrected the API Keys "API reference" button: it opened
`https://docs.hanzo.ai/api`, but the docs site serves everything under `/docs`
(a bare `docs.hanzo.ai/<slug>` 404s), so it now opens `${config.docsUrl}/docs/api`
(white-labeled off the brand's docs host, matching every other docs deep link).

How it was found + proven: an authenticated iframe-batch crawler on the live
origin (same-origin ⇒ real session) that detects a 404 by the `document.title`
flipping to "404: This page could not be found." after client hydration (the SSR
shell 200s for every path — AuthGate renders a loader, and the catch-all's
`notFound()` fires only client-side, so HTTP status can't distinguish routes). Swept
ALL 137 product roots (0 bad) and every real UI navigation target (`router.push`
literal + template targets extracted from source); the three `go(t.id)` tab
modules were the only breakage. `/datasets/:name` and `/scores/:name` 404 for a
hand-typed URL but nothing links there (not a dead link). Registry docs deep links
all use the correct `https://docs.hanzo.ai/docs/<slug>` form.

Verification: `tsc --noEmit` clean; `vitest` **1643/1643** (129 files); the
icon-ESM registry stays un-importable in vitest (documented), so the registry
route contract is proven by the live re-crawl (authoritative gate), not a unit
test. Rebased on origin/main (v8.4.85, the o11y-logs lane) → **v8.4.86**. Live
re-crawl (every Containers/Fine-tuning/Tasks tab resolves; zero customer 404s) is
the post-deploy gate.

## Drop dead Docs buttons — 6 products with no docs page (v8.4.87)

Follow-up to v8.4.86's docs-link audit, coordinated with the docs lane. The
product registry set `docs: `${DOCS}/<slug>`` (→ `docs.hanzo.ai/docs/<slug>`) for
every product, but 6 of those slugs have NO page on docs.hanzo.ai and no honest
target (a redirect would mislead) — each "Docs" button 404'd. Verified all six
return HTTP 404 live (`curl -o/dev/null -w%{http_code}`): accessibility, crm, erp,
templates, markets, trading. Removed the `docs:` field from those 6 registry
entries. The consumers read `entry.docs ?? config.docsUrl`, so the button now
falls back to the docs root (a real page) instead of a dead deep link — zero 404.
The docs lane owns the OTHER previously-missing slugs (analytics, auto, cms,
helpdesk, apm, apps, nodes + bare /crawl /functions /kms) via docs-side redirects,
so those `docs:` fields stay. No other change; the 66 remaining `${DOCS}/<slug>`
deep links are unchanged.

Verification: `tsc --noEmit` clean; `vitest` green (no test asserts these `docs:`
fields — the `spec.docs` in resolve.test is the NativeOverview inline-docs spec, a
different field). Rebased on origin/main (v8.4.86) → **v8.4.87**. Live re-verify:
the 6 product overviews no longer render a dead Docs deep link (button dropped /
roots to docs.hanzo.ai), zero customer 404s — post-deploy gate.

## Marketplace model cards show the MODEL VENDOR's canonical brand logo (v8.4.92, #57)

Model cards resolved their avatar from the provider string ALONE, so two classes
read wrong: (1) a model served through the api.hanzo.ai gateway is tagged provider
"hanzo" (verified live: `/v1/models` returns `qwen3.5-397b`, `glm-5.2`, `kimi-k2.6`,
`minimax-m2.5` all `owned_by:"hanzo"`), and `normalizeBrand("hanzo")` → the house
brand, so a Qwen/Zhipu/Moonshot/MiniMax model showed the Hanzo block-H; (2) the
proprietary vendors that DO carry clean providers (`Anthropic`/`OpenAI`/`Google`,
confirmed live in `/v1/pricing/models`) rendered a bland "A" monogram (Anthropic had
NO curated mark) or Hanzo's own invented glyphs (an asterisk for OpenAI, a Gemma gem
for Google) rather than the vendor's real logo. Fixed both, DRY, one resolver:

- **Identity-first resolution (the id/prefix map).** New pure `brandForModel(idOrName,
  provider)` (`components/ui/brand.ts`) = `normalizeBrand(idOrName) ?? normalizeBrand
  (provider)` — the MODEL id/name (e.g. `anthropic/claude-opus-4.6`, `openai/gpt-5`,
  `google/gemini-2.5-pro`, `qwen3.5-397b`, `glm-5.2`) is authoritative, so a gateway
  model tagged "hanzo" is NOT shadowed into the house brand; its true vendor wins.
  Zen ids (`zen*`) and genuinely-Hanzo ids with no third-party tell still resolve to
  the house brand — **Hanzo stays ONLY the fallback**. Because it keys off the id
  prefix, a NEW model resolves on its own with no per-model map. `ProviderLogo` gained
  an optional `model?` prop that, when set, resolves via `brandForModel` (else the
  existing provider-only path — non-model surfaces like Integrations/Provider-admin
  unchanged). Wired at every per-model call site: Marketplace card, Model Catalog
  detail, Playground ModelPicker (chip + rows).
- **Canonical vendor marks (self-contained inline SVG, no CDN → CSP-safe, theme-aware
  by construction — white knockout on the brand-hue tile reads on light AND dark).**
  `brand-marks.ts`: ADDED **Anthropic** (the sunburst/spark radial burst on the coral
  #D97757 tile); REPLACED **OpenAI** with its blossom knot (three interlocking ellipse
  loops = the six-fold rosette, on black); REPLACED **Google** with the **Gemini**
  four-point spark star (on Google blue) — the Google-AI mark covering Gemini + the
  Gemma slice. Qwen/Meta/DeepSeek/Mistral/xAI(grok)/Moonshot/NVIDIA marks unchanged.
  Each mark body validated in a headless browser (non-zero `getBBox`, no path errors).
- **Coherent card, one resolution.** The Marketplace `ListingCard` derives logo +
  provider LABEL (`brandLabel`, full vendor names; house → "Zen") + the house
  "Verified" badge from the SAME `brandForModel` result — so a gateway-served Qwen
  model never reads "Qwen logo + Zen label + Verified". `brandLabel` maps both house
  keys (`zen`/`hanzo`) to "Zen" (our models are branded Zen), matching `displayProvider`.
- **White-label:** these are the MODEL VENDOR's brands (shown on every brand host —
  hanzo/lux/zoo), orthogonal to the platform brand; only the house brand (Zen) renders
  the Hanzo mark.
- Verification: `tsc --noEmit` clean; `vitest` **1667/1667** (+15 brand: brandForModel
  gateway-shadow/identity-first/zen-preserved/hanzo-fallback, brandLabel, Anthropic
  mark + all-marks-distinct); the 3 new/changed SVG marks proven to render in a
  headless browser. Live before-state captured as z@hanzo.ai (Claude="A" mono,
  GPT-5=invented knot, Gemini=Gemma gem, gateway Qwen/GLM/Kimi/MiniMax=Hanzo-H).
  Branched off origin/main (v8.4.91) → **v8.4.92**. Live re-verify (Claude→Anthropic,
  Gemini→Gemini spark, GPT-5→OpenAI blossom, Zen→Hanzo) is the post-deploy gate.

## Header-scoped modules wired to /cloud + canonical docs links + chat/crawl fixes (v8.4.93)

A deep customer-facing audit (grep + LIVE probing every backend head as Dave/
maxpower) found the LAST systemic "renders but silently-not-connected" class and a
cluster of dead docs links. The framework/s3 fix (v8.4.70) — "the live ingress
routes bare `/v1/*` to the gateway, which strips the client X-Org-Id and 403s a
cookie-only request, so bearer-scoped heads MUST address the `/v1` user-bearer
proxy EXPLICITLY" — was applied to framework/s3/machines but NEVER to the OTHER
header-scoped heads. Their clients still built a bare `/v1/<head>` via `originV1Url`,
which 403s live, so ~15 customer products rendered an honest error/empty card instead
of their real per-org data. VERIFIED LIVE: `/v1/{gpus,clusters,functions,platform,
vpcs,load-balancers,builds,releases,pipelines,environments,indexers,oracles,authz,
search}` all 403 while their `/v1/*` twins 200.

- **Transport class-fix (`originV1Url`/`v1Url` → `cloudProxyV1Url`)** in every
  bearer-scoped client: `compute.ts` (gpus/alerts/pools), `functions.ts`,
  `platform.ts` (clusters + org/cluster), `paas.ts` + `platform-apps.ts` (platform
  head), `embeddings.ts` (the Explore vector `search`/`search/stats` — kept
  `originV1Url('embeddings')`, an AI head that IS session-scoped), and the inline
  single-head modules Vpc/LoadBalancer/Builds/Releases/Pipelines/Environments/
  Indexer/Oracles/Authz. All heads are already in `proxy-allow.ts` `CLOUD_HEADS`, so
  the `/v1` proxy admits them; the response shape is identical (same cloud-api
  handler, just a minted bearer). `memory` was LEFT on bare `/v1` — verified live it
  is session-scoped (`/v1/memory/list` = 200). `canonical-paths.test.ts` MOVED
  gpus/clusters/functions/paas from the "canonical /v1" block to the "/cloud
  exception" block (it had ENSHRINED the broken bare-path assumption) + `functions.
  test.ts` now asserts `/v1/functions`.
- **Canonical docs links.** The docs site serves product pages under `/docs/<slug>`
  (a bare `docs.hanzo.ai/<slug>` mostly 404s); the registry `docs:` fields were
  already correct (v8.4.86) but a batch of INLINE module links were not: EdgeModule
  (`/edge`→`/docs/edge`), StorageModule (`/storage`→`/docs/storage`), machines
  LaunchDrawer + CustomerMachines (`/vm`→`/docs/machines`, `/gpus`→`/docs/gpus`),
  AgentsModule (`/agents`→`/docs/agents`), inference RightRail/panes/StatusBoard
  (`/inference`→`/docs/gateway` — inference has no docs page), FunctionsModule
  (`/functions`→`/docs/functions`, `/kms`→`/docs/kms`), SearchModule (`/crawl`→
  `/docs/crawl`). The shared ProductLanding kit's `standardResources` built a bare
  `/<product>` + non-existent `/quickstart|/examples|/api-reference` sub-pages (all
  404 — the Embeddings overview rail's 4 doc rows were dead); now `/docs/<product>`
  (Mintlify is one page per product; the sub-rows point at the product page, API →
  the real `/docs/api`).
- **Chat History→View owner bug.** `ChatView` hardcoded owner `'admin'`; casibase
  chats are keyed `owner/name` and a customer org's chats are NOT owned by `admin`,
  so every saved chat 404'd ("Failed to load chat"). The real owner now travels in a
  new 2-segment route `/chat/:owner/:name` (unambiguous by segment count); a legacy
  1-segment link defaults owner to the active org — never a hardcoded `admin`.
- **Crawl tabs navigated away.** `SearchModule` renders BOTH `/websearch` and
  `/crawl` but hardcoded `/websearch/*` in its tab strip + "Try a search" CTA, so
  every tab/CTA on the Crawl page jumped to Web Search. Base path now derives from
  `usePathname()`; docs point at `/docs/crawl` (Crawl) or `/docs` (Web Search — no
  page, `/docs/websearch` 500s).
- **Honest-dead surfaces reported, not faked (roadmap).** DNS, Zero-Trust,
  Referrals, Dashboards, Experiments, Scores-analytics all 404 on this deployment
  BOTH via bare `/v1` AND `/v1` — their backends genuinely don't exist here yet;
  they render honest `BackendStateCard`/`RuntimeNotice` (forward-compatible — light
  up when the backend appears), so they were LEFT honest rather than regressed to a
  static 'soon'. o11y (Service Map/Alerts/Logs/per-product Status·Logs·Metrics) is
  the same class: the cloud→O11y `/v1/o11y/*` reverse-proxy isn't resolved on this
  deployment (404 both ways) — an infra gap, not a console client-path bug.
- Verification: `tsc --noEmit` clean; `vitest` **1658/1658** (131 files); `next
  build` ✓ Compiled successfully. Rebased on origin/main (v8.4.92, marketplace
  logos) → **v8.4.93**. Live re-verify as Dave (the ~15 rewired modules show real
  per-org data / honest-empty, every fixed Docs button 200s, saved chats open,
  Crawl tabs stay under /crawl) is the post-deploy gate.

## Integration release — @hanzo/ui design-system polish (#58) + billing surface completed (#29) (v8.4.101)

Integration-lead pass over the open feature branches: only the two GENUINELY-NEW,
canonical branches were merged (onto a fast-moving origin/main — d052760/v8.4.99 at
merge time, re-integrated up through abb87e5/v8.4.100 before landing at v8.4.101). Every other listed
branch was reviewed and SKIPPED as already-superseded by main's own advancement
(verified by merge-tree/`git cherry`/file presence, never a guess) — merging them
would have regressed main or introduced a second way to do a thing already done:
`native-o11y-ui` (net = package.json only — the Fleet/ProductObservability o11y is
already on main), `o11y-app-logs-live`+`o11y-transport-nav-fixes` (main has the
canonical v8.4.62/74/85 O11y logs + the Observations/Users nav entries),
`admin-cogs` (vendor COGS+margin already on the business board via `finance.ts`;
its `/costs` proxy is a divergent second mechanism, and its living/adapters are
−600 lines behind main), `integrations-page` (main already ships the canonical
customer `OrgIntegrationsModule` Connect/authorize/disconnect page + `integrations.ts`),
`finance-vendor-donut` (−435 lines behind main's finance adapters), `product-landings`
(re-adds an `app/railway-demo` page main intentionally deleted; add/add on
`landing/logic` main already owns), `automations-tile` (merge-tree ≡ main), and
`mobile-fixes` (its PageHeader subtitle-wrap is byte-identical to what main already
ships). `backup/*` untouched per policy.

- **#58 @hanzo/ui design-system polish** (`feat/console-ui-58`, clean merge): org-brand
  sidebar header + Hanzo-H fallback (`DashboardShell`/`BrandLogo`), Material
  elevation/paper tokens (`globals.css`), a DRY alphabetical + selected-first product
  sort (`src/lib/products/order.ts` + tests), the mobile nav drawer opening LEFT
  (matching the top-left hamburger) and auto-closing on a product tap, and an
  opacity-only `hz-menu-in` entrance for floating-ui anchored menus (SelectMenu/ComboBox)
  so a transform-animation never detaches the menu from its trigger (transform-based
  `hz-pop-in` stays for centered Dialog surfaces). @hanzo/gui v5 shorthands only; no
  Svelte/Radix. Includes the recovered in-progress edits from the dev agent's cut-off
  session, committed cleanly.
- **#29 Billing surface completed** (`feat/billing-surface-complete`) — the Billing
  Center's three external-portal punts are now IN-CONSOLE over the ONE per-tenant
  `/billing/v1/*` commerce proxy; no new backend, PCI posture unchanged, tenant scoping
  server-authoritative:
  - **Payment Methods** (`PaymentMethodsModule`) — in-console ADD (Square's own card
    iframe tokenizes in-browser; only the opaque single-use nonce is POSTed — the raw
    PAN never touches our code/servers/logs, SAQ-A, with a `billing.test.ts` no-PAN-leak
    assertion) + per-row REMOVE (`DELETE /v1/billing/payment-methods/:id`). Set-default
    was fail-secure-skipped (the endpoint bakes the customer id in the path — un-scopeable
    from the browser).
  - **Subscriptions** (`SubscriptionsModule`) — in-console Cancel (explicit "at period
    end" vs "now") / Reactivate; the `:id` always from the caller's own scoped list,
    commerce re-authorizes against the server-pinned subject.
  - **Invoice PDF** — download builds the URL from the invoice `id`
    (`billingProxyV1Url('invoices/'+id+'/pdf')`), opened same-origin (session-scoped).
  - **Hardened proxy** — extracted into the tested `src/lib/server/billing-proxy.ts`
    (`forwardBilling`, the bearer-proxy pattern): GET+POST+DELETE, a non-JSON upstream
    (application/pdf) passed through as RAW BYTES (Content-Type/-Disposition forwarded),
    empty body → null (204-safe). All security intact: session-auth 401, cross-origin
    CSRF refusal, path-segment validation, service-Bearer injection, `X-Org-Id` from the
    validated session, `scopedBillingSearch` pinning the full billing-subject key set on
    every verb.
  - **DRY** — the ~40-line Square card mount+tokenize is ONE reusable `useSquareCard`
    hook (`src/lib/billing/use-square-card.ts`) shared by BillingCredits (Add credits) +
    PaymentMethods (Add a card).
- Verification (this integration, in an isolated worktree off origin/main v8.4.99):
  `tsc --noEmit` clean; `vitest` **all green** (132 → 133+ files, ~1697+ tests after
  console-ui-58, billing suites fold in); merged with only an append-only LLM.md doc
  conflict (resolved: main's superset kept, this note appended). Landed at
  **v8.4.101** (patch — never major; v8.4.100 was taken by a concurrent push, so the
  next free patch was used). CI builds the `console` image at
  `:v<package.json version>`; live re-verify (sign-in + key surfaces render) is the
  post-deploy gate. The universe CR bump is owned by the universe agent (not touched
  here to avoid a race) — the new console semver is **v8.4.101**.

## Budgets & limits — EXTEND the existing Budgets page with spend caps + rate limits (Hanzo Cloud #70)

Extends the EXISTING Budgets page (`components/products/billing/BillingBudgets.tsx`,
the `/billing/budgets` tab under the Billing center in Observe) from create/list soft
alerts into a full **Budgets & limits** surface — per-scope HARD spend caps and request
rate limits — over the SAME real commerce spend-alerts API (`/v1/billing/spend-alerts`,
via the per-tenant `/billing` proxy). This REPLACES an earlier scaffolded separate
`/v1/commerce/limits` "Limits" module: the CTO re-anchored mid-build (that endpoint is
being dropped — a 2nd parallel system), so it was folded into Budgets and repointed. No
new nav entry (Budgets already lives beside Billing/Status in Observe). One budgets
surface, one endpoint.

- **`lib/api/billing.ts`** — `SpendAlert` extended with the new spend-alerts fields:
  `project`/`service` (''=all → org-wide default), `enforce` (true = HARD cap, billable
  calls 402 at the cap; false = soft alert), `softPct` (warn %, default 80),
  `rateLimitRpm` (0 = no limit, else 429), and the READ-ONLY projections
  `periodSpentCents`/`over`/`warn`. `normalizeSpendAlerts` reads them defensively
  (snake_case tolerant, sensible defaults) so a LEGACY soft-alert row renders as an
  org-wide alert TODAY and the meter/enforce/rate-limit surface lights up the moment the
  backend emits the fields — forward-compatible, nothing fabricated. `createSpendAlert`
  takes the new fields; added `updateSpendAlert` (PATCH `/spend-alerts/:id`) +
  `deleteSpendAlert` (DELETE `/spend-alerts/:id`). Added a **PATCH** verb to
  `app/billing/v1/[...path]/route.ts` (`forwardBilling` already forwards `req.method` +
  CSRF-guards non-safe methods — SAFE_METHODS = GET/HEAD/OPTIONS — and pins the billing
  subject server-side via `scopedBillingSearch`, so edit/delete are subject-scoped from
  the browser). NOTE (flagged to the spend-alerts backend lane): per-ALERT ownership
  WITHIN a subject must be enforced backend-side (the subject pin scopes to the caller,
  not to a specific alert row) — the reason the old code hid edit/delete.
- **`components/products/billing/budgets-logic.ts`** (PURE + tested) — `capVerdict`
  (unlimited/over/warn/ok, trusts the backend `over`/`warn` flags then falls back to
  cap+soft math), `spendPct`, `scopeTypeOf`/`scopeLabel`, `deriveBudgetsSummary` (incl.
  an `enforced` count), and boundary parsing/validation (non-negative dollars→cents,
  softPct 0–100, non-negative-int rpm, scope-id required for project/service, a hard cap
  requires cap>0). `formForAlert` round-trips a row into the edit form.
- **`BillingBudgets.tsx`** — per-scope CARDS (not a fixed table): a responsive spend
  meter (periodSpentCents/threshold, green→amber→red by verdict; honest "Unlimited spend"
  at cap=0), a verdict pill + a Hard-cap/Alert-only mode pill, and cap/soft/rate/mode
  facts. SET: an add form + inline per-card edit sharing ONE `BudgetFields` editor
  (Name · Scope selector Org-wide/Project/Service + id · Spend cap $ · Soft-warn % ·
  Rate limit req/min · **Enforce (hard cap)** toggle) → POST/PATCH; per-row remove →
  DELETE (confirm). A 5-tile KPI summary band (Budgets/Hard caps/Warnings/Over cap/Spent
  this period, reusing `MetricCard`). Honest states: skeleton loading, `BackendStateCard`
  (hint `GET /v1/billing/spend-alerts`), rich `EmptyState`; refetch-after-save. @hanzo/ui
  (`@hanzo/gui` v5 shorthands) + `FieldSelect`/`FieldSwitch`; mobile-first `flexWrap`/
  `minW` rows, NO horizontal body scroll.
- Verification: `tsc --noEmit` clean; `vitest` all green (+21 budgets-logic tests
  replacing the removed limits tests); `next build` ✓ (the Budgets tab renders via the
  BillingModule `:tab` route). Responsive e2e (`e2e/budgets-responsive.spec.ts`, mocked
  spend-alerts + admin session) renders four budgets (org-default hard-cap on-track /
  project warn / service over / unlimited-throttle) at 1440px AND 390px, asserts NO
  horizontal body scroll at 390px, and opens the inline edit form on mobile — screenshots
  in `e2e-shots/budgets-{desktop,mobile,edit}.png`. Removed the earlier separate
  scaffolding (`lib/api/limits.ts`, `components/products/limits/`, the `limits` registry
  + `COMMERCE_HEADS` entries, `limits-responsive.spec.ts`). Feature branch
  `feat/commerce-limits-page`; no version bump (the release/merge agent bumps
  `package.json` + tags the image). Consumes the extended `/v1/billing/spend-alerts`
  shape as-is; if a field is absent the row degrades to an honest soft alert (never
  fabricated).

## OSS Authors product — connect GitHub, verify repos, earn on deploys (v8.4.111)

Mirrors the Affiliates + Referrals pattern for the new **OSS Author program** over the
real cloud `/v1/authors` surface (native-Go `clients/authors`: an author earns a royalty
on the metered platform spend of every org that DEPLOYS their open-source project on
Hanzo). One customer module + one admin module + two API clients + a pure logic helper,
registered through the one `registry.tsx` + the server allow-lists — the same shape as
Affiliates, nothing forked.

- **`AuthorsModule`** (customer, `id:'authors'`, Web3) — two states, one module:
  NOT enrolled → a **Connect GitHub** card (optional login when no linked GitHub account
  is detected) + a 3-step explainer; ENROLLED → the dashboard: status pill + verified
  identity + share rate, four MetricCards (Repos/Accrued/Pending/Paid), a **repositories**
  panel (verify a repo → OAuth admin-check OR the `hanzo.json` verify-code file; per-repo
  **Copy badge** for the ready-to-paste "Deploy on Hanzo" markdown), a **verify-by-file**
  helper (the `hanzo.json` snippet + copy), a **deploys of your work** list, and payout
  history. Every value real or an honest empty/`—`.
- **`AuthorsAdminModule`** (`id:'authors-admin'`, `admin:true`, Observe) — the
  global-admin operator board: Run-sweep + summary tiles + the author directory
  (org/GitHub/status/repos/deploys/accrued/pending/paid) with per-status actions
  (Approve + share override / Reactivate / Pay out credits|cash / Suspend). Server-gated
  via `getAdminGate` behind `/admin/aggregate`; honest access/empty/error states.
- **Clients:** `lib/api/authors.ts` (customer, BARE JSON via `cloudProxyV1Url` +
  defensive normalizers) and `lib/api/admin-authors.ts` (admin, `{status,msg,data}`
  envelope via `originGet`/`originPost`), plus the pure `products/authors/logic.ts`
  (`usd`/`sharePct`/`statusLabel`/`statusTone`/`shortDate`/`payoutMethodLabel`/
  `verifyMethodLabel`/`dollarsToCents`).
- **Registration (no `app/` route — the catch-all resolves it):** two catalog entries in
  `registry.tsx`; `'authors'` added to `proxy-allow.ts` `CLOUD_HEADS` (the per-tenant
  head) + `next.config.mjs` `ADMIN_V1_HEADS` and `admin-aggregate.ts` `ADMIN_AGGREGATE_HEADS`
  (the global-admin twin). No
  `claim.ts`/session wiring (Authors is connect/verify-based — there is no `?xxx=` signup
  link, unlike Affiliates' `?aff`).

## Every cloud API path is `/v1/`-rooted — killed the `/cloud/` prefix (v8.4.120)

- **CTO contract:** ZERO prefix before `/v1/` on ANY cloud API call (same rule as "no
  `/api/`"). The console used to rewrite `/v1/<cloudhead>` → `/cloud/v1/<cloudhead>` (in
  `next.config.mjs`) and `cloudProxyV1Url` built `/cloud/v1/…` directly, so the `/cloud/`
  prefix leaked to clients and 404'd Automations (`/v1/automations/*` → `/cloud/v1/automations/*`).
- **The BFF moved, the security did NOT change.** The user-bearer proxy that mints a
  short-lived IAM token from the session cookie (cookie NEVER reaches cloud-api; org is
  server-authoritative from the Bearer `owner`; CSRF same-origin guard on mutations;
  least-privilege `allowCloudSurface` allow-list) moved from `app/cloud/[...path]` to
  **`app/v1/[...path]`**. It re-prepends the `v1/` root (the catch-all sits under `/v1`),
  so the allow-list and the upstream URL still see `v1/<head>`. Every guard in
  `forwardWithUserBearer` is preserved — this is a PATH change, not a security change.
- **Removed:** the `CLOUD_V1_HEADS`/`CLOUD_INFRA_V1_HEADS`/`CLOUD_PRODUCT_V1_HEADS` rewrite
  lists in `next.config.mjs` (cloud heads now fall THROUGH to the `/v1` catch-all — no
  rewrite). `cloudProxyBase` deleted; `cloudProxyV1Url === originV1Url` (both `/v1/<path>`).
- **Kept (dispatch, `beforeFiles` — win over the catch-all):** AI heads → `/ai`, admin
  aggregate `/v1/admin/*` → `/admin/aggregate`, visor catalog (regions/sizes/gpu-sizes) →
  `/vm`, `/v1/billing/*` → `/billing/v1`, `/v1/commerce/*` → `/commerce/v1`. These are
  server-internal (client only ever builds `/v1/…`); `/billing`+`/commerce` use their own
  service-token / different-audience proxies, so they stay namespaced (out of scope).
- **Acceptance (live, built server):** `GET /v1/automations/connectors` → 401 JSON
  `{"error":"Sign in to use Hanzo Cloud."}` (reaches the cloud BFF, NOT a 404, NOT the SPA
  shell); `/v1/agents`, `/v1/platform/projects` → 401 JSON (regression OK); `/v1/billing/balance`
  → 401 JSON `"Sign in to view billing."` (the distinct message proves the billing dispatch
  still wins); `/v1/bogushead` → 404 JSON `{"error":"Not found"}` (allow-list refuses a
  non-head — still not a general tunnel). `git grep /cloud/v1` = ZERO. tsc + build green,
  1965/1965 unit tests pass.

## Insights (o11y) repointed to the VERSION-LESS `/v1/o11y/<resource>` surface, via the /v1 bearer BFF (v8.4.124)

The rebooted o11y backend (cloud embedded o11y v1.5.4) serves the canonical
VERSION-LESS surface `/v1/o11y/<resource>` — NO nested `v1`/`v3` version, NO `/api`.
Proven live (unauthenticated, against api.hanzo.ai): `GET /v1/o11y/health` → **200**
`{"service":"o11y","status":"ok"}`; `POST /v1/o11y/services`, `POST /v1/o11y/query_range`,
`GET /v1/o11y/rules` → **403 `no validated principal`** (IAM-gated — anonymous refused, a
logged-in bearer required); the deprecated `/v1/o11y/v1/rules` alias still resolves (403,
not 404). The console's Insights modules were still calling the nested-version SigNoz forms
(`/v1/o11y/v1/*`, `/v1/o11y/v3/query_range`) over `originV1Url` (a bare `/v1/o11y/*`), which
on the live console ingress reaches the gateway with NO minted bearer → 403. Fixed both
axes, one class-fix:

- **Version-less paths.** `apm.ts` (`ApmApi` — Service Map RED metrics, dependency graph,
  top-operations, infra hosts/pods/nodes, exceptions/listErrors, dashboards, and the
  composite logs/traces `query_range`) now speaks `o11y/services`, `o11y/dependency_graph`,
  `o11y/service/top_operations`, `o11y/hosts/list`, `o11y/query_range`, `o11y/listErrors`,
  `o11y/dashboards`, … (the nested `v1/`·`v3/` segments dropped). `AlertsModule` → `o11y/rules`.
  `o11y.ts` annotation-queues/users were already version-less; added an `O11yApi.health()`
  probe (`o11y/health`).
- **Bearer BFF (the IAM-gate fix).** o11y reads build `cloudProxyV1Url("o11y/<resource>")`.
  Since v8.4.120 retired the `/cloud/` prefix, `cloudProxyV1Url` is an alias of `originV1Url`
  and both yield the canonical `<origin>/v1/o11y/<resource>` — o11y rides the same-origin
  `app/v1/[...path]` bearer BFF like every other IAM-scoped cloud head. The BFF mints the
  caller's short-lived IAM bearer → cloud-api sees a validated principal → 200 (a cookie-only
  call is refused). The `o11y` head is allow-listed in `proxy-allow.ts` `CLOUD_HEADS`.
- **Reachable on admin.hanzo.ai.** The Observe product modules (Traces `/o11y`, Service Map,
  Logs, Analytics, Dashboards, AI Metrics) plus the global-admin **Fleet Observability** board
  (`fleet-o11y`, `AdminO11yModule`, `admin: true`) are all on the SuperAdmin's nav — a global
  admin's `visibleCatalog(showAdmin=true)` returns the FULL catalog. No nav surfacing change was
  needed; the Insights surfaces were already registered under Observe. Per-org o11y needs only a
  validated principal (works for any signed-in org); the cross-org Fleet board additionally
  requires `owner==admin`.
- **Traces/Observations data domain — flagged, NOT ripped.** `TracesModule`/`ObservationsModule`
  read the LLM/agent trace domain via `O11yApi` → `EvalsApi` on `/v1/evals` (cost/tokens/scores
  that raw OTel spans lack). The rebooted backend also serves `/v1/o11y/traces` +
  `/v1/o11y/observations` from the `o11y_` tables; repointing those READS off evals is a
  DATA-DOMAIN change (would drop the eval joins), so it is deliberately left for a CTO call
  rather than guessed in this path-form pass (documented in `o11y.ts`).
- **Playwright proof.** `e2e/insights-o11y.spec.ts` — two layers: (A) an UNAUTHENTICATED gate
  proof that ALWAYS runs and PASSES LIVE today (health 200 + the reads 403 "no validated
  principal" + the alias resolves); (B) an AUTHENTICATED render proof (signs in, enters
  admin.hanzo.ai or falls back to console — same image, asserts `/v1/o11y/*` PASSES the gate
  (not 403) for a signed-in session, and Service Map/Logs/Traces/Fleet Observability RENDER —
  real data or the honest RuntimeNotice, never a crash — with screenshots). B is STAGED: it needs
  the reserved-`admin`-org SuperAdmin password (a KMS secret, not on the dev host) AND a browser
  env that renders the Tamagui/RNW SPA (the sandbox headless chromium loads all 22 chunks but the
  React root stays empty). `e2e/probe-o11y.spec.ts` discovery harness also repointed to the
  version-less `/v1/o11y/*` forms.
- Verification: `tsc --noEmit` clean; `vitest` green (`canonical-paths` now pins
  `ApmApi.dashboards → /v1/o11y/dashboards`; `apm-service-scope` pins `/v1/o11y/query_range`);
  Proof A runs green against the live cluster. Rebased onto main (post-v8.4.120 `/cloud`-prefix
  retirement) → **v8.4.124**.
## First-run onboarding — 2FA · consent · team · trial credits · AI access (feat/onboarding)

A guided post-signup wizard (Vercel-style) shown ONCE to a signed-in user who
hasn't finished it, then never again. It runs AFTER auth + org selection (a NEW
`OnboardingGate` inside the dashboard layout, placed inside `PreferencesProvider`
+ `ToastProvider` but ABOVE the launcher/palette/chat providers so no overlay
floats over the takeover), and reuses the console's existing real surfaces — it
does NOT reinvent MFA, billing, or AI-connection storage. Six steps, in order:

- **1 · Secure account (2FA) — REAL.** Enrolls TOTP over the existing `MfaApi` →
  `/console/mfa/*` BFF → IAM `mfa/setup/{initiate,verify,enable}` (the same path
  Profile → Security uses). Skippable ("Skip securing my account"); if 2FA is
  already on (session claims) it just confirms.
- **2 · Data & consent — persisted (see gap).** Required Terms + Privacy
  acknowledgement + an OPTIONAL "improve models with my data" toggle (DEFAULT
  OFF). Persisted onto the account via the onboarding preference.
- **3 · Team / workspace — REAL.** Confirms the org (created at first-run
  `OrgOnboarding`) and lets the user NAME it via `TeamApi.{organization,
  updateOrganization}` (org-admin, own-org-pinned server-side). Best-effort —
  never blocks the flow.
- **4 · Free trial credits — REAL.** Card-on-file → trial credits, no upfront
  charge. The card is entered ONLY in Square's hosted element (`useSquareCard`,
  the PAN never touches the console); `BillingApi.createPaymentMethod({token})`
  vaults it (commerce grants/extends the trial as a handler side-effect, $1
  verify-then-void), `welcome()` claims the fixed starter grant (idempotent), and
  `balance()` shows the granted balance. Honest "payments not configured" when
  `paymentConfig` has no Square app. Skippable.
- **5 · AI access — REAL (b/c), honest gap (a).** Three cards: (a) **Connect a
  provider login (OAuth)** — a real 3-legged OAuth to sign into a ChatGPT/Claude/
  Gemini account is NOT on the backend, so this is an honest "coming soon", never a
  fake connection; (b) **Bring your own API keys** — paste an OpenAI/Anthropic/
  Google key, wired to the REAL, KMS-sealed AI Login Manager (new `AiConnectionsApi`
  → `/v1/ai/connections`, ai#79/#80; `v1/ai/connections` added to the `/ai` proxy
  allow-list; keys sealed server-side, never plaintext); (c) **Let Hanzo power it**
  — one-click smart routing via `AiAccountsApi.saveSettings({routingEnabled:true})`
  (the native router, up to 90% cheaper).
- **6 · First action — REAL.** CTA tiles (Start a chat · Playground · Create an
  API key · Deploy a project) that complete onboarding and deep-link into the
  product; plus "Go to console".

- **Persistence + resume/skip.** The whole state is ONE object under the account
  preference `onboarding` (`usePreferences().set` → `AccountApi.updatePreferences`,
  cross-device) — `completed` flag, resume `step`, per-step status, `consent`, and
  `aiChoices`. A half-finished flow RESUMES at the saved step; "I'll finish later"
  hides it for the session (sessionStorage, still resumable); a completed one never
  shows again. Skipped in the static embed + on the admin host.
- **BACKEND GAP (flagged, mitigated).** The canonical write `POST /v1/iam/update-
  preferences` is NOT served by IAM today (the whole console preferences system
  rides it; the optimistic write silently no-ops) — so completion also writes a
  LOCAL guard (`lib/onboarding/guard.ts`, localStorage) so the wizard never
  re-nags before the endpoint lands, and upgrades to cross-device automatically
  once it does. **Backend tickets:** (1) IAM `update-preferences` (self-scoped
  shallow-merge into `Properties["hanzo.preferences"]`); (2) AI provider-login
  OAuth (authorize/callback for OpenAI/Anthropic/Google model accounts — the
  KB-connector OAuth in `cloud/clients/knowledge` is the template); (3) optional:
  a fixed-amount, webhook-driven trial grant on `payment_method.added` (today the
  grant is a synchronous `CreatePaymentMethod` side-effect of a plan-derived
  amount + the idempotent `welcome()` $5).
- **Files.** Pure logic `src/lib/onboarding/steps.ts` (+ `steps.test.ts`, 11
  tests) + `guard.ts`; `src/components/onboarding/` (`OnboardingGate`,
  `OnboardingWizard`, `parts.tsx`, `types.ts`, `steps/{Secure,Consent,Team,
  Credits,AiAccess,Launch}Step.tsx`); new client `src/lib/api/ai-connections.ts`;
  `app/ai/[...path]/route.ts` (+`v1/ai/connections` head); `app/(dashboard)/
  layout.tsx` (mounts the gate). Strictly @hanzo/gui v5 shorthands, monochrome +
  Geist, reuses `PrimaryButton`/`Field*`/`FadeIn`/`HanzoMark`/`useToast`.
- **Verification.** `tsc --noEmit` clean; `vitest` **2074/2074** (175 files; +11
  onboarding-logic); `next build` ✓ Compiled successfully (all routes register).
  Authenticated visual e2e of the flow is post-deploy (the `(dashboard)` group is
  behind AuthGate). No version bump — the release/merge agent bumps `package.json`
  + tags the image.

## console.hanzo.ai is the project HUB — deploy IAM-native projects + cross-surface deep links (v8.4.125)

Makes console the **project hub**: create an IAM-native project → drag-drop a static
build to deploy it over the embedded PaaS → manage deployments/domains/config → and
deep-link the SAME project to hanzo.app (edit) and hanzo.chat (chat) on ONE shared key.
Builds on the current main (the SBOM platform-deployments panel #145 stays; models,
the removed billing band, and single-level nav are untouched).

- **New first-class `Platform` product** (`registry.tsx` id `platform`, category
  Platform, icon `Layers`, `kind:'module'`, routes `'' | ':name'`) → shows in the
  sidebar, the home Apps map, the app launcher, and gets the shared per-product
  Status/Logs/Metrics/Settings — like every product, via the ONE `visibleCatalog` gate
  (ungated on this deployment; entitlements endpoint 404 = show-all). The existing
  `projects` entry stays the thin org→project SCOPE picker (no duplicate — both create
  through the ONE `ProjectApi.create`); `apps` stays the read-only hanzo.app-published
  sites lens.
- **ONE shared key, IAM-native.** A project is IAM-native (`ProjectApi`, keyed by
  `name`); the create form slugifies the name so `name === deploy site slug === the
  cross-surface ?project= value` — no `svc` suffix, no second copy of project state.
  `ProjectApi.create` gained an optional `displayName` (friendly label; the slug is the
  id) — additive, backward-compatible.
- **Deploy = the embedded PaaS static engine** (`/v1/platform/sites/*`, the SAME store
  hanzo.app deploys to; cloud `clients/projectsvc`, PR #204). New client
  `lib/api/platform-sites.ts` (`PlatformSitesApi` — list/get/create/ensure/update,
  `deploy` (raw artifact), listDeployments/getDeployment, list/bindDomains) over the
  same-origin `/v1` bearer BFF (`platform` head already allow-listed; org from the
  Bearer owner). The project HUB detail (`platform-hub/PlatformDetail.tsx`) has a
  drag-and-drop **DeployDropzone** (a `.zip`/`.tar.gz` uploaded verbatim, or a FOLDER
  packed client-side to tar.gz), a deployments table with per-deploy **status/logs**
  (the deployment record + its message — static deploys are synchronous, no build log),
  a custom-domains bind/list panel (honest 403 for a non-operator org), and a
  framework/cache/description config editor.
- **Binary upload through the ONE proxy (DRY, benefits every future upload).** The
  shared `bearer-proxy.forwardWithUserBearer` now forwards a NON-JSON body VERBATIM
  (bytes + its own Content-Type incl. any multipart boundary) instead of
  `req.text()`-decoding it (which UTF-8-corrupts binary) and re-stamping
  `application/json`. New `client.restPostRaw` posts the artifact bytes (keeps the
  401-refresh via `authedFetch`). Pure client-side archive builder
  (`lib/deploy/archive.ts` — a correct ustar tar + native `CompressionStream` gzip) +
  drop/folder reader (`lib/deploy/drop.ts`, `webkitGetAsEntry` walk).
- **Cross-surface deep links (both directions).** `lib/products/cross-surface.ts` —
  `?project=<iamProjectId>`, matching the repo's existing `apps.ts builderEditUrl`
  convention: **Edit → `hanzo.app/dev?project=<id>`**, **Chat →
  `hanzo.chat/?project=<id>`** (injection-safe via `URLSearchParams`; `config.chatUrl`
  added, env `NEXT_PUBLIC_CHAT_URL`). Inbound: `components/ProjectDeepLink.tsx` (mounted
  in the dashboard layout) honors an inbound `?project=` (opened from hanzo.app/chat) →
  selects that project scope + opens its hub detail.
- Verification: `tsc --noEmit` clean; `vitest` **2122/2122** (180 files; +48 new:
  cross-surface deep-link/slug, archive tar builder, hub logic, platform-sites contract,
  bearer-proxy binary-passthrough + Content-Type preservation); `next build` ✓ (the
  `platform` product + `:name` detail register). Live authenticated Playwright proof
  (Platform in the sidebar/map, create → drag-drop deploy → cross-surface links) is the
  post-deploy gate. Deep-link shape coordinated to the shared `?project=` key.

### Platform is always-on — the HUB shows for every org (v8.4.126)

Live verification of v8.4.125 (Playwright, signed in as Dave/maxpower, an org admin)
found the new `platform` product resolved but did NOT appear in the customer's sidebar
or Apps map: maxpower is entitlement-gated (enabled set = models/chat + the always-on
essentials), and `platform` was neither always-on nor in its enabled set. Since the
project HUB is a FIRST-CLASS, foundational capability (create → deploy → ship a project),
it belongs with the always-on essentials, not behind an opt-in. Fix: add `platform` to
`ALWAYS_ON_PRODUCTS` (entitlements.ts) so it shows in the sidebar + home Apps map +
launcher for EVERY org (the route already resolved via the full catalog). `tsc` clean;
`vitest` green (entitlements iterate-list test unaffected). Rebuild/redeploy → v8.4.126.

### DEPLOY REALITY: console.hanzo.ai serves the go:embed'd console in the CLOUD binary (not the standalone `console` CR)

Discovered live while verifying the HUB (v8.4.126): the ingress
`hanzo-domains-console-hanzo-ai` routes `console.hanzo.ai/ → cloud:8000`
(server header `fasthttp` = the Go cloud binary). Per universe `crs/console.yaml`
(RETIRED 2026-07-07), the standalone Next.js console was superseded by a
**go:embed'd static export of THIS repo inside `hanzoai/cloud`** — the cloud
Dockerfile has a `console` stage: `git clone --branch ${CONSOLE_REF}` (default
`main`) → `npm run build:embed` (static export, prunes server routes) → go:embed
into the binary. The standalone `console` CR still runs (replicas 2) but is
UNROUTED. So:

- Building `ghcr.io/hanzoai/console:vX.Y.Z` + patching the `console` CR does NOT
  update console.hanzo.ai. It only refreshes the (unrouted) standalone pods.
- To ship a console change to console.hanzo.ai, the **cloud binary** must be
  rebuilt embedding `console@<ref>`. It is AUTOMATIC: `CONSOLE_REF` defaults to
  `main` (no CI override), so the next cloud release from main embeds whatever is
  on console `main`. `npm run build:embed` MUST stay green (the cloud build
  fail-hards on a broken/placeholder bundle) — verified green for the HUB.
- The embedded console calls cloud's `/v1` DIRECTLY (same origin → cloud:8000,
  cookie-authenticated via SanitizeIdentity) — the Next BFF proxies (`app/v1`,
  `/ai`, …) are pruned by build:embed. So client code must work against cloud's
  native `/v1` (it does; the HUB's deploy upload POSTs the raw artifact straight
  to cloud's `/v1/platform/sites/:slug/deploy`). The `bearer-proxy` binary-body
  fix only matters for the (unrouted) standalone console — harmless in the embed.
- Net: the HUB (create/deploy/domains/cross-surface links) goes live on
  console.hanzo.ai on the next `hanzoai/cloud` release from main (CONSOLE_REF=main
  = the HUB commit). Coordinate the cloud release with the cloud lane; do NOT
  expect a console-only image bump to appear on console.hanzo.ai.

## admin.hanzo.ai Provider Billing — multi-provider credit + funding split (feat/admin-provider-billing)

A new GLOBAL-ADMIN board answering "how much of each upstream AI provider's credit
remains, what's the burn/runway, and how does spend split across OUR-credit / paid /
paid-only / BYO". The ECONOMIC sibling of the existing AI-Providers ROUTING board
(`ProviderAdminModule`, id `provider-admin`, which flips State/IsDefault) — registered
RIGHT NEXT TO it in category AI (`admin: true`, hidden from every customer). The
CONSOLE frontend half of a two-agent split; a sibling agent owns the `ai`+`cloud` Go
backend endpoints.

- **Authoritative contract (built against VERBATIM):**
  - `GET /v1/admin/providers/credit` → `[{provider, grant_cents, burn_cents,
    remaining_cents, runway_days, has_credit, is_paid_only}]`.
  - `GET /v1/admin/usage/funding?from&to` → `[{provider, model, funding, tokens,
    cost_cents, requests}]`, `funding ∈ {credit, paid, paid_only, byo}`.
- **ZERO plumbing change — both heads were ALREADY wired.** `providers` and `usage`
  are already in `ADMIN_AGGREGATE_HEADS` (`admin-aggregate.ts`) + `ADMIN_V1_HEADS`
  (`next.config.mjs`), and `allowAdminSurface` admits `v1/admin/<head>/...` sub-paths,
  so `/v1/admin/providers/credit` + `/v1/admin/usage/funding` pass the global-admin
  gate (`getAdminGate`, fail-closed 403 → minted user bearer) with no proxy/rewrite
  edit. In the go:embed console they hit cloud's `/v1/admin/*` directly under the
  first-party session cookie (BFF pruned) — same client code, `originV1Url` pins the
  console's OWN origin so a split cloud URL can't route around the gate.
- **Client `src/lib/api/provider-billing.ts` (pure + fully unit-tested).** Transport
  is `restGet` (raw JSON) + a tolerant `pluckList` that accepts the bare `[...]` the
  contract documents OR the casibase `{data:[...]}` / `{usage:[...]}` envelope its
  sibling admin routes use (ONE code path, honest `[]` on garbage) — robust to
  whichever shape the backend ships. Defensive snake_case+camelCase normalizers
  (`normalizeCredit`/`normalizeFunding`); pure roll-ups `creditSummary` (totals + MIN
  runway = the provider that runs out first) and `foldFunding` (per-class buckets +
  grand total + ordered cost slices, unknown classes kept in their own bucket, never
  dropped); `FUNDING_META` (label+color+hint, ONE source), `runwayLabel`/`runwayTone`
  (∞ / `—` / `< 1 day` / N days; red < 2wk, amber < 6wk), `usd`/`compactNumber`, and
  `fundingWindow(range)` → RFC3339 `{from,to}` reusing the shared `rangeStart` (flag:
  if the backend wants epoch/date-only, that's the one line to change).
- **Module `src/components/products/admin/ProvidersBillingModule.tsx`.** (1) Provider
  credit — a summary band (Remaining / Granted / Burn·day / Min runway) + per-provider
  cards (remaining balance big in tabular-nums `hz-mono`, burn/day, runway, and a
  has-credit / paid-only / depleted badge). (2) Credit-vs-paid usage — a `RangeTabs`
  (24h/7d/30d) window, a per-class KPI band (Total + Our credit / Paid / Paid-only /
  BYO with % of spend), a cost-by-funding `Donut` (legend + total center), and a
  provider×model funding table sorted by cost. Honest states throughout: two
  independent `Promise.allSettled` reads (one failing never blanks the other), a 403
  on EITHER → the shared `OperatorAccessRequired` (both ride the one admin gate),
  `ErrorState` on other failures, honest empty for a zero/one-provider set (DO is the
  only funded provider tonight; the other 5 slot in as keys drop). Money is
  tabular-nums; arbitrary chart colors go through `style` (the Tamagui bg/color props
  take only tokens + hex literals — the Charts.tsx convention).
- **Registry:** one import + one `admin: true` catalog entry (`id: 'provider-billing'`,
  label "Provider Billing", category AI, icon Coins) directly after `provider-admin`.
- **Verification.** `tsc --noEmit` clean; `vitest` **+25** provider-billing tests
  (pluckList bare/envelope/garbage, normalizers snake+camel + runway-null, foldFunding
  per-class+unknown, creditSummary min-runway, runwayLabel/Tone, formatting,
  fundingWindow) — full suite **2320/2320** green; `npm run build:embed` ✓ (the cloud
  go:embed gate — static export ready, 31 route handlers restored). **Playwright visual
  proof** (`e2e/provider-billing.spec.ts`, local dev, network-mocked global-admin
  session): the board RENDERS the DO $26k credit card ($24,180 remaining of $26,000,
  58-day runway, HAS-CREDIT badge; openrouter 3-day runway in red; openai-direct
  PAID-ONLY) + the full credit-vs-paid split (Our credit 26% / Paid 62% / Paid-only
  13% / BYO 0%, glm-5.2 row) at desktop AND mobile (no horizontal body scroll) —
  screenshots `e2e-shots/provider-billing-{desktop,mobile}.png`. LIVE layer (fail-closed
  gate + authed real-DO render) is STAGED behind the sibling's endpoint deploy +
  HANZO_PASSWORD (reserved-admin SuperAdmin secret), like `insights-o11y.spec`.
- **Deploy:** console change → ships to console.hanzo.ai/admin.hanzo.ai via the next
  `hanzoai/cloud` release embedding `console@main` (CONSOLE_REF=main); `build:embed`
  is green so the cloud build won't fail-hard. No standalone console image bump reaches
  console.hanzo.ai (the standalone CR is unrouted). Coordinate the cloud release with
  the cloud lane. No version bump here — the merge/release agent bumps `package.json`.

## Every client-facing same-origin API path is `/v1/`-FIRST — one version, no `/prefix/vN/`, no nesting (feat/v1-first-paths)

Comprehensive enforcement of the /v1-first law across EVERY same-origin API namespace —
**superseding the v8.4.16 `/billing/v1/` namespacing** and completing the v8.4.120 "/v1-rooted"
contract. The law: a client-facing same-origin API path is `/v1/<head>/…` — ONE version, NO
`/<svc>/vN/` prefix, NO nested `/v1/<x>/vN/`, NO `/api/`. After this,
`git grep -oE '/[a-z-]+/v[0-9]/'` over src/app/next.config returns ONLY external hosts.

- **ONE mechanism, DRY (matching v8.4.120).** The CLIENT builds `/v1/<head>/…`; each
  non-cloud-api proxy is a FILESYSTEM route `app/v1/<svc>/[...path]` — MORE SPECIFIC than the
  `app/v1/[...path]` cloud BFF catch-all, so Next resolves `/v1/<svc>/*` straight to it (proven
  in the `next build` route table: every `/v1/<svc>/[...path]` is a distinct route beside
  `/v1/[...path]`). Bearer/service-token proxies re-root the upstream at `v1/`
  (`` const path = `v1/${params.path.join('/')}` ``) — the exact path the backend + the
  least-privilege allow-list see. NO rewrite for these — filesystem precedence dispatches.
  This REMOVES the v8.4.120 `/v1/billing → /billing/v1` and `/v1/commerce → /commerce/v1`
  beforeFiles rewrites. The stale v8.4.70 "ingress routes `/v1/*` straight to the gateway,
  bypassing Next, so bare `/v1/billing` 403s" rationale is DISPROVEN by v8.4.120's own live
  acceptance (`/v1/billing/balance` → 401 "Sign in to view billing" REACHED the Next billing
  proxy), so the explicit `/<svc>/v1` addressing it justified is gone.
- **Namespaces migrated (handler `git mv`'d, history preserved):** `/billing/v1/*` →
  `/v1/billing/*` (service token); `/commerce/v1/*` → `/v1/commerce/*` (user bearer);
  `/ai-accounts/v1/*` → `/v1/ai-accounts/*` (+ settings/usage/routing-defaults sub-routes);
  `/economy/v1/*` → `/v1/economy/*`; `/nodes/v1/*` → `/v1/nodes/*`; `/trading/v1/*` →
  `/v1/trading/*` (the brand-scoped read proxies drop the `v1/` route discriminator to `<x>`);
  `/superbase/v1/*` → `/v1/superbase/*` (the generic `BaseDataApi` `baseUrl` is now the
  version-root `/v1/superbase`; its handler re-roots to Base's `/v1/…`); `/vm/v1/*` →
  `/v1/vm/*` (visor catalog; the `regions/sizes/gpu-sizes` beforeFiles dispatch retargeted to
  `/v1/vm/*`). Each proxy's AUTH/scoping/CSRF/service-token/allow-list is UNCHANGED — only the
  PATH moved. UI tab routes (`/billing/*`, `/ai-accounts/*`) still render (they differ at the
  FIRST segment from the `/v1/…` data plane).
- **AI heads (`/ai/v1/` → clean `/v1/*`).** playground images/videos + ai-connections built
  `/ai/v1/*` directly; they now build `/v1/images/generations` · `/v1/videos/generations` ·
  `/v1/ai/connections` (ONE path — drops the ai-connections IS_EMBED split). `next.config.mjs`
  dispatches the AI heads to the `/ai` bearer proxy WITHOUT a nested version (destination
  `/ai/<head>`, not `/ai/v1/<head>`); `app/ai/[...path]` re-roots the upstream at `v1/`. New
  `ai` head so `/v1/ai/connections` dispatches (never shadows a cloud head — `ai` ≠ `ai-accounts`
  as a segment). This also fixes image/video/connections on the go:embed console (the old
  `/ai/v1/*` had no cloud route there).
- **Nested inner-version dropped.** `/v1/websearch/v1/scrape` → `/v1/websearch/scrape` (the
  scrape descriptor/Fact — the console documents it, never calls it live; the cloud websearch
  backend should serve the flat form). `/v1/o11y/*` was already version-less (v8.4.124).
  `apm.ts` stale SigNoz-upstream `/api/v1/<resource>` doc comments repointed to the
  `/v1/o11y/<resource>` the client actually calls.
- **Left (external, not ours — full `https://<host>`):** Gatus `status.<brand>/api/v1/
  endpoints/statuses`, Cloudflare Turnstile `challenges.cloudflare.com/turnstile/v0/`, Slack
  OAuth `slack.com/oauth/v2/`. External provider paths, untouched.
- **Deploy unchanged either way.** go:embed console (console.hanzo.ai): `build:embed` prunes
  the route handlers (recursive `app/**/route.ts` stash catches the nested `app/v1/<svc>/`
  handlers) → the static export terminates at cloud's native `/v1/*` under the first-party
  session cookie — same as before, just prefix-free. Standalone (console2/admin): the
  filesystem route (or the `/ai` dispatch) serves it.
- Verification: `tsc --noEmit` clean; `vitest` **2445/2445** (206 files; canonical-paths/
  billing/aimetrics/plans/embed-paths/visor/ai-connections path assertions updated to the
  `/v1/<head>` forms); `next build` ✓ (route table); `npm run build:embed` ✓ (go:embed gate,
  31 handlers stashed+restored). `git grep -oE '/[a-z-]+/v[0-9]/'` = external hosts only.

## Social — one surface, shared parts (social.hanzo.ai)

**social.hanzo.ai IS this console**, booted in the `social`-only product shell
(`PRODUCT_SHELLS.social` → `config.isSocialHost`/`socialOnly` → `SocialModule`) over
the folded `/v1/social` in the cloud binary. The standalone `social-frontend` pod was
retired by the ingress cutover (`universe` `routes.yaml`: `/v1`+`/healthz` →
`cloud-api-hanzo-ai` at prio 100, root → `console-hanzo-ai`) — there is deliberately
NO second dedicated app, and login rides the console's own `hanzo-cloud` path.

The presentational half lives ONCE in **`@hanzo/ui/product/social`**: `ChannelBadge`,
`PostCard`, `CampaignCard`, plus `SocialSummaryBar`, `ViewToggle`, `PostAgenda`,
`PostComposer`, `ProviderReadinessList` and the pure `format` module
(`formatPostTime`/`postDayBucket`/`postPreview`/`parsePostTime`). Data and handlers are
injected — `SocialApi` and every failure classification stay here.

- **Blocked on a publish**: those parts are in the `@hanzo/ui` source at **8.0.12** but
  the published **8.0.11** never shipped a `product/social` — so `SocialModule` still
  renders its local copies. `@hanzo/ui`'s own `pnpm run build` fails first: `src/index.ts`
  re-exports the local `./backends/shadcn`, whose `clsx`/`tailwind-merge`/
  `class-variance-authority`/`@radix-ui/*` imports are declared nowhere (the package
  ships `@hanzo/ui-shadcn` as a *peer* instead). Fix that entry, publish 8.0.12, then
  switch `SocialModule`'s social imports to `@hanzo/ui/product` and drop the local ones.
- **No invented endpoints.** Cloud `clients/social` serves only summary, providers,
  accounts CRUD, posts CRUD, `posts/:id/publish` — there is no OAuth callback, no
  analytics, no media upload, no teams. Publishing fails CLOSED with the exact missing
  provider env vars; the composer surfaces that verbatim, never a fake "connected".
- `Post.media` round-trips (cloud always serializes an array and its PUT rebuilds the
  row from the body, so dropping it would wipe a post's media).

## Inference Router — per-org router policy editor over /v1-first paths (v8.4.136)

The customer face of the virtual `auto`/`zen-router` model: an org's own admins
set their task → model-pool prefer table + per-1k cost ceiling. New catalog entry
`inference-router` (AI category, beside `models`) → `InferenceRouterModule`
(registry `''` route): a task-pool form (the 8 canonical router task tags,
comma-separated ordered model ids, empty = inherit) + a cost-ceiling field +
Save/Reset, with honest loading/BackendStateCard/effective-table states. Saving
an empty prefer + 0 ceiling clears the org override (reverts to "*" then conf) —
the honest "reset to platform default".

- **Backend (hanzoai/ai, same wave):** `GET /v1/get-router-policy` +
  `POST /v1/update-router-policy` — org-admin gated, self-scoped to the token
  org (never another tenant's), resolved org > "*" > conf per task key.
  `OrgSettings` grew `RouterPrefer`/`RouterCostCeiling`; `resolveAutoModel`
  folds the policy per request (caller `X-Max-Cost` still wins).
- **Transport (v1-first law):** the client (`lib/api/router-policy.ts`) builds
  `/v1/get-router-policy` / `/v1/update-router-policy` via `originGet`/
  `originPost` (casibase envelope). Standalone: the two heads are added to
  `AI_V1_HEADS` (next.config dispatch → the ONE `/ai` user-bearer proxy) + its
  `ALLOWED` set — no new route handlers. go:embed: the same paths hit cloud
  natively (needs cloud to serve/forward the ai-gateway router endpoints; until
  then the module shows the honest BackendStateCard, never fabricated config).
- **Three routing surfaces, three concerns (not duplicates):** `models`' admin
  "Routing" tab = PLATFORM ModelRoute config; `ai-accounts` Routing tab = the
  user's smart-routing on/off preference; `inference-router` = the ORG's own
  policy table. Entitlement-gated like the rest of the AI family (not always-on).
- Verification: `tsc --noEmit` clean; `vitest` 2525/2525 (212 files);
  `next build` ✓; `npm run build:embed` ✓ (31 handlers stashed+restored).

## Router — observability dashboard (cost saved · quality · per-task mix) over the reused policy editor (feat/router-admin-panel)

Upgrades the `router` product (was the single policy-editor `''` route — v8.4.136,
`InferenceRouterModule`) into a two-tab **routing dashboard**, so a customer sees
"what routing buys me" AND still configures it — ONE editor, one place, no
duplication. Completes the v8.4.137 "Inference Router → Router" rename that HEAD
left half-applied (the `git mv`'d files still referenced the old
`~/lib/api/router-policy` + `InferenceRouterModule` names, which no longer existed —
origin/main did NOT build; the consistency fix is folded in here, no package bump).

- **Two tabs, one entry** (`RouterModule.tsx`, registry `''` + `:tab`, `subpages:
  [{policy}]`, AI category, entitlement-gated like the AI family — org admins
  configure their own router, so NOT `admin:true`). **Overview** = routing
  observability; **Policy** = the reused λ/µ editor. The editor moved to
  `RouterPolicyEditor.tsx` (renamed from the old `RouterModule.tsx`, export
  `InferenceRouterModule` → `RouterPolicyEditor`, import fixed to `~/lib/api/router`)
  and is EMBEDDED as the Policy tab — never a second copy. The `router` id keeps the
  clean `/router` URL (the old `inference-router` id is retired; the feature is fresh
  from v8.4.136).
- **Overview reads `GET /v1/router/stats`** (org-scoped, RequirePrincipal upstream)
  via `RouterStatsApi` (`lib/api/router.ts`, `originGet('router/stats', {hours})` —
  casibase envelope, same transport as `get-router-policy`). A range toggle
  (24h/7d/30d → `?hours=`, within the server's 90d cap). Renders: **(a) Cost saved**
  — `saved_pct` headline + `routed_index` vs `counterfactual_index` (vs the premium
  `baseline_model`) + `cumulative_saved_index`, LABELED a blended `$/MTok` PROXY (the
  ledger has no token counts), honest "—" when `priced_events==0`; **(b) Quality
  proxy** — `reward_rate` (+ `rewarded_events` coverage), `engine_share`,
  `avg_confidence`, and `shadow_agreement` ONLY when non-null (else an honest "not
  available yet" tile); **(c) Per-task distribution** — `by_task` as a per-task Donut
  (models by share) + a `by_model` Donut + a `throughput` LineChart (24 buckets); the
  **(e) training-contribution toggle** and **(f)** the retrain line below.
- **Opt-in training contribution** (`TrainingContributionApi`) — a `@hanzo/gui`
  `FieldSwitch` wired to `GET/POST /v1/{get,update}-training-contribution`
  ("Improve routing with our usage — feature vectors only, never prompt text"),
  optimistic with an honest revert-on-failure toast; honest "not available on this
  deployment yet" when the read fails.
- **(f) Retrain line** — `retrain` (when present) → "Last retrained &lt;time&gt; ·
  gate &lt;kind&gt; &lt;metric&gt; &lt;value&gt; vs &lt;base&gt; · published/kept
  incumbent".
- **Pure, tested logic** (`components/products/router/logic.ts` — no React/Gui/
  registry imports, node-testable per the icon-ESM convention): `normalizeStats`
  (partial/garbage payload → honest empty, never a throw; `cost` stays null, not $0,
  with no priced events; nullable `$` indices + `shadow_agreement` preserved),
  `moneyIndex`/`fractionPct`/`savedPctLabel`/`rewardLabel`/`shadowAgreementLabel` (all
  em-dash on absent), `modelSlices`/`taskBreakdown` (by share), `throughputSeries`
  (UTC `HH:mm` labels, index fallback), `retrainLine`, `hoursFor`. +15 tests
  (`logic.test.ts`). Reuses the dependency-free `ui/Charts` (Donut/LineChart) +
  `ui/Metric` (MetricCard/Panel) + `EmptyState`/`BackendStateCard`/`Loader` — no chart
  dep, honest states everywhere.
- **Transport wiring (mirrors `get-router-policy` exactly):** three heads added to
  `next.config.mjs` `AI_V1_HEADS` (`router` + `get-/update-training-contribution` →
  the `/ai` bearer proxy) and to `app/ai/[...path]` `ALLOWED`
  (`v1/router/stats`, `v1/{get,update}-training-contribution`) — no new route
  handlers. go:embed: the same `/v1/*` paths hit cloud natively (cloud must serve/
  forward the ai-gateway router endpoints; until then the honest BackendStateCard,
  never fabricated stats) — identical caveat to v8.4.136.
- **Backend contract:** hanzoai/ai `feat/router-stats-observability`
  (`controllers/router_stats.go`: `GetRouterStats`/`GetTrainingContribution`/
  `UpdateTrainingContribution`, all `c.ResponseOk` → casibase envelope). Not yet on
  ai `main` — until the ai wave ships, the dashboard shows the honest state.
- Verification: `tsc --noEmit` clean; `vitest` 2540/2540 (213 files; +15 router
  logic); `next build` ✓; `npm run build:embed` ✓ (31 handlers stashed+restored). No
  package bump (release agent owns it); the new console semver will be the next patch
  above the release train's current tip. Authenticated visual e2e (the `(dashboard)`
  group is behind AuthGate) is the post-deploy gate. Reaches admin.hanzo.ai/
  console.hanzo.ai only on the next `hanzoai/cloud` release embedding `console@main`
  (`CONSOLE_REF=main`) — a standalone console image bump does NOT; coordinate the
  cloud release with the cloud lane.

## Models surfaces — catalog benchmarks · leaderboard · per-org Enso blend (feat/models-surfaces)

Three additions to the ONE `models` product (tabs Catalog · Leaderboard · Blend ·
Routing), so the same surface answers what can I run, what is any good, and what does
MY org run. No new nav entry, no second catalog: the Catalog tab is enriched in place
and the two new tabs are `:tab` routes on the existing entry.

- **WHERE THE BENCHMARK NUMBERS COME FROM (the data decision).** The corpus is a
  CHECKED-IN FIXTURE (`src/lib/api/benchmarks.data.json`), regenerated by
  `scripts/sync-benchmarks.mjs` from hanzoai/enso-bench `priors/leaderboard.json` +
  `harness/arms.py`, and imported at BUILD TIME. It is a versioned artefact, not live
  state — it changes when a bench run lands, not per request — so an endpoint would buy
  nothing and cost a loading state, a failure mode, and a fabrication risk on every page
  view. Build-time import makes the leaderboard render instantly, offline, and typed. The
  sync script copies keys RAW and fails loudly rather than emitting a silently-empty
  fixture (an empty leaderboard must never be mistaken for an empty corpus).
  `src/lib/api/benchmarks.ts` is the ONE reader: `normalizeModelKey` folds the corpus's
  many spellings (`gpt-5.2`, `/gpt-5.2`, `openai-gpt-5.2`) onto one join key, and the
  arms.py alias pairs bridge a LIVE gateway id to its corpus row. Deliberately
  conservative — spellings differing by WORD ORDER stay unmerged, because attaching a
  real number to the wrong model is the worst failure available here.
- **Nothing is invented.** Every score keeps its `source` (`hanzo-measured` = our own
  harness through api.hanzo.ai, badged; the rest = provider/third-party context, shown
  verbatim). A model with no published score renders an EM-DASH, never a zero; a model
  unscored on the selected benchmark is OMITTED from the ranking, never ranked last at
  0.0 — an absent measurement is not a bad measurement.
- **Blend = a faithful port of arms.py `resolve_blend`** (`src/lib/models/blend.ts`), not
  a reinvention: the three operators in order (`enable` allowlist, where `null` = inherit
  the catalog and is NOT the same as `[]`; `disable` denylist applied after; `add`
  appended after both), and flash/blend/ultra as PRICE BANDS (`0.2·in + 0.8·out`) that
  RE-FORM as the blend changes. Toggling one model off from inherit records a DENYLIST
  entry and KEEPS inheriting, so the org still receives models added to the catalog later.
  Pinned by `blend.test.ts` AND by `blend-parity.test.ts`, which EXECUTES arms.py and
  diffs its real output — that parity suite caught a genuine divergence (Python's stable
  sort keeps CATALOG order for equally-priced models like opus-4.8/opus-4.6; an id
  tie-break in the port silently reordered them, so the tie-break was removed). It skips
  cleanly when the enso-bench checkout is absent, so CI never fails on a missing sibling.
- **Blend persistence rides the org's EXISTING OrgSettings row** (`org-blend.ts`,
  read-modify-write like `org-settings.ts`) — no new endpoint invented. TODO(hanzoai/ai)
  names the three required columns (`enabledModels` / `disabledModels` / `customModels`)
  on the existing get/update-org-settings pair. The client is NOT a stub: it reads and
  writes them for real, then RE-READS to confirm they survived, and the board says plainly
  "Blend storage is not live yet" when they did not — a UI that cheerfully confirms a
  write the backend discarded is worse than one that says it cannot save yet.
- **Vendor logos** reuse the existing `ProviderLogo` (self-contained inline marks, CC0
  shapes, monogram fallback, no CDN, CSP-safe) — no hotlinks, no fabricated URLs. The
  blend row's vendor LABEL now resolves identity-first through `brandForModel` /
  `brandLabel`, the same resolver the avatar uses, so a gateway-served model (provider
  tagged "hanzo") reads Zhipu/Moonshot rather than "Zen" beside its own Zhipu/Moonshot
  logo — the mismatch v8.4.92 fixed for logos, now closed for the text too.
- **Catalog tab enriched in place:** a Vision badge from the catalog's own `features`
  (`supportsVision`, input capability — an image-GENERATION model is deliberately not
  "vision"), the benchmark headline, and BOTH sides of the price (in / out $ per Mtok).
- Verification: `tsc --noEmit` clean; `vitest` +43 (blend semantics, arms.py parity,
  corpus reader/join/honesty); `next build` ✓; `npm run build:embed` ✓ (the go:embed
  gate). RENDER-proven, not just mocked: `e2e/models-surfaces.spec.ts` drives all three
  surfaces in a browser — the leaderboard ranks the real corpus with sources, a Blend
  toggle re-forms the Enso tiers on screen, the unscored row shows an em-dash with zero
  "0.0" anywhere, and neither board scrolls the body sideways at 390px. Two render-spec
  gotchas worth knowing for the next spec: the first-run `OnboardingGate` is a full
  takeover that must be marked done (`hz_onboarding_done:<owner>`), and `OrgGate` needs
  `hanzo.console.org.selected`, or the page under test never mounts.

## Workbench — the persistent Developers dock (Stripe-Workbench pattern) (v8.4.143)

A bottom Developers dock on every dashboard page (the Stripe Workbench footer-shell
pattern): a slim always-there bar ("Developers" + a `$` prompt + quick icons) that
expands into a drawer with three tabs — available anywhere without leaving the page.
Desktop-only (lg+); open state persists via the ONE preferences store
(`workbenchOpen`). Mounted once in `DashboardShell` below the content ScrollView.

- **Overview** — the org's real API activity (requests · errors · tokens · spend,
  last 24h) rolled up from the charged commerce usage ledger (`fetchUsageRecords` +
  `totalsOf`/`withinRange` — the aimetrics primitives, nothing forked), with deep
  links to AI Metrics + API keys. Real numbers or an honest zero, never mocked.
- **Logs** — the 50 most recent charged calls (time · model · status · tokens ·
  cost), the same ledger rows the Logs product renders.
- **Shell** — a READ-ONLY same-origin `/v1` explorer: `GET /v1/models` (or just
  `models`) runs as the caller through the ONE `/v1` surface (bearer BFF standalone /
  cloud-native in the embed) and pretty-prints the JSON, output bounded. Mutations
  are refused with an honest message — they belong in the product UIs. Command
  parsing + output bounding are the pure `workbench/logic.ts` (scheme/traversal/
  method-refusal unit-tested).
- Files: `src/components/workbench/{Workbench.tsx,logic.ts,logic.test.ts}` + the one
  `DashboardShell` mount. No new route handlers → no build:embed churn.
- **Render-proven** (`e2e/workbench.spec.ts`, mocked network on the local dev
  server): the bar renders, the drawer opens with the exact mocked ledger roll-up
  (3 req · 1 error · 1590 tokens · $0.16), Logs shows the rows, the shell runs a
  real `/v1/models` GET and refuses `DELETE`. Screenshots
  `e2e-shots/workbench-{overview,shell}.png`. NEW render-spec gotchas (post the
  IAM-PKCE auth move): identity is seeded via `sessionStorage`
  `hanzo_iam_access_token` (forged unsigned JWT w/ future `exp`) +
  `hanzo_iam_expires_at`, userinfo served by route-mocking `**/userinfo` (let
  `.well-known` 404 — the SDK synthesizes endpoints); and the first-run GUIDED TOUR
  overlays the whole page at z=100000, so seed `hz_tour_seen:v1:<owner>` alongside
  `hz_onboarding_done:<owner>` or every click hangs on actionability. The older
  `/auth/session`-mock specs (e.g. budgets-responsive) are stale against this auth
  model and skip/fail locally — flagged, not fixed here.
- Verification: `tsc --noEmit` clean; `vitest` 2756 passed (+5 workbench logic; 8 skipped);
  `next build` ✓; `npm run build:embed` ✓; the workbench render spec green locally.
  Ships to console.hanzo.ai via the next cloud release embedding `console@main`.

## Studio embedded — every Studio capability usable in-console (v8.4.145)

The `studio` product no longer renders the NativeOverview brochure: `StudioModule`
embeds the FULL Hanzo Studio app (home gallery · node editor via a Studio/Editor
toggle · queue/GPUs/copilot inside the frame) in a first-party SAME-SITE iframe —
studio.<brand> shares the console host's eTLD+1, so Studio's own IAM session
cookies flow and its OIDC leg completes silently for a signed-in user (a live
hanzo.id session never renders the login — authorize just 302s). When the frame
cannot establish a session (expired IAM cookie — the login page sends
frame-ancestors 'none' by design), the header's "Full screen" is the honest
fallback; nothing embedded is fabricated. WHITE-LABEL: `studioUrl(host)` in
config is the ONE gate — only a brand with its OWN instance gets a URL (hanzo →
studio.hanzo.ai); every other brand gets null → an honest not-provisioned card,
NEVER another brand's Studio (locked by 2 config tests). The shared per-product
Status/Logs/Metrics/Settings subpages are untouched (base-slug routing).
Verification: tsc clean; vitest 2758 (+2); next build ✓; build:embed ✓; local
render proof (seeded-auth recipe) shows toggle + Full screen + the live iframe
src. Reaches cloud.hanzo.ai/console.hanzo.ai on the next cloud release embedding
console@main.

## e2e auth migration — primeSession (IAM-PKCE) replaces the retired /auth/session mocks (v8.4.146)

The 11 fixture render specs authenticated via a mocked `/auth/session` — an endpoint
the IAM-PKCE auth move retired — so every one of them landed on /signin locally. ONE
helper now owns the recipe: `e2e/_session.ts` `primeSession(page, claims?)` seeds the
forged sessionStorage token (`hanzo_iam_access_token` + `hanzo_iam_expires_at`),
mocks `**/userinfo` (discovery left to 404 — the SDK synthesizes endpoints), and
seeds the interaction gates (tour/onboarding/org). Registered AFTER a spec's own
catch-all it wins for the IAM endpoints (Playwright matches routes newest-first), so
the legacy `/auth/session` branches are dead code, not conflicts. All 12 specs
(incl. workbench) ride it; per-spec ACCOUNT objects pass through as claims (owner is
what makes a super-admin — owner==='admin'). Also re-pinned auth-adjacent mock drift:
budgets `/billing/v1/spend-alerts`→`/v1/billing/spend-alerts`, gpus-connect
machines/gpus regexes admit the `/v1/vm/*` forms, entitlement-sidebar's
"Add product"→"All products". Two tests are `test.fixme` with the drift named
(gpus-connect machines contract; entitlement All-products pane flow) — their
feature lanes own the re-pin. Sample run: workbench/budgets/provider-billing/
models-surfaces/router-config/gpus-responsive/ai-economics/cd-canvas-map/
blank-audit/interactive-training → 151+ passed locally.

## go:embed org-switcher + Observe→Status fix — IAM-admin & PaaS address cloud-native /v1/* (v8.4.149)

LIVE production fix (console.hanzo.ai + cloud.hanzo.ai): the org/user switcher was
MISSING from the shell and Observe→Status showed "Could not reach the platform /
Invalid response from server (HTTP 200)". ONE root cause, confirmed end-to-end (live
curl + deployed-bundle disassembly + the cloud router + both client call-sites):

- console.hanzo.ai / cloud.hanzo.ai serve the **go:embed** static console INSIDE the
  cloud binary (`ghcr.io/hanzoai/cloud`), whose `webui.go` treats ONLY
  `apiPrefixes = {/v1/, /zap, /healthz, /readyz}` as API — every OTHER path falls through
  to `serveIndex` → **HTTP 200 + index.html**. `build-embed.mjs` STASHES every Next
  `app/**/route.ts` (the BFF reverse-proxies), so any client still addressing a NON-`/v1/`
  BFF prefix hits the SPA shell and the JSON parse throws.
- Two client transports were never migrated off the BFF prefixes (unlike `telemetry.ts`,
  already on `/v1/o11y/vm`): `admin.ts` `makeIamClient('/admin/iam')` (OrgSwitcher +
  OrgPicker + AdminModule + TenantsModule) and `platform.ts` `/paas/*` (Observe→Status
  apps inventory). In the embed both → 200 SPA HTML → OrgSwitcher/OrgPicker swallow the
  error (empty list → switcher gone) and Status → `interpretPlatformError` → "Could not
  reach the platform / Invalid response from server (HTTP 200)".
- The genuine `/v1/*` API is HEALTHY (o11y/health 200, o11y/metrics 403-JSON, get-account
  200, `/v1/iam/get-organizations` 401-JSON, `/v1/paas/apps` 403-JSON). Cloud already
  serves the correct equivalents natively.

Fix (minimal, `IS_EMBED`-gated — the standalone console2/admin.hanzo.ai `/v1` BFF
deliberately EXCLUDES `iam/*` and `paas/*`, proxy-allow.ts:7, so it CANNOT be
unconditional): in the go:embed only, the IAM-admin client uses cloud-native
`/v1/iam/<segment>` via the existing bearer-scoped `client.ts` `iamList`/`iamOne`/
`iamMutate`, and the PaaS inventory addresses `/v1/paas/<path>` via `cloudProxyV1Url`.
Standalone/admin.hanzo.ai are UNCHANGED (keep their gated `/admin/iam` + `/paas`
proxies). Scoping is unchanged: OrgSwitcher still lists cross-tenant only for a super
admin (`account.owner === 'admin'`), and cloud/IAM enforces the per-principal org scope.
z@hanzo.ai IAM verified independently: `admin/z` (global superadmin, owner=admin) +
`hanzo/z` (admin/owner of hanzo) both exist, un-forbidden, authenticate live — no seed
needed. (Separate flag: the `admin-console` IAM app's clientId is `Iv23li3SYLoq40ExR6EN`,
not `admin-console` — a distinct admin.hanzo.ai SSO risk, not this bug.)

Verification: `tsc --noEmit` clean for the two files (0 errors; the 4 remaining are
pre-existing local `@hanzo/ui`/`@hanzo/brand` node_modules drift); `vitest` baseline
109/109 (admin/platform/canonical-paths — no standalone regression) + new
`iam-paas-embed.test.ts` 3/3 pinning the embed URLs (`/v1/iam/get-organizations?owner=admin`,
`/v1/paas/apps`, `/v1/iam/approve-user`; never `/admin/iam/` or `/paas/`). Ships to
console.hanzo.ai/cloud.hanzo.ai on the next `hanzoai/cloud` release embedding
`console@main` (CONSOLE_REF=main) — a standalone console image bump does NOT reach those
hosts (the standalone CR is unrouted). Authenticated live re-verify (z logged in →
switcher populates + Status renders) is the post-deploy gate.

## admin.hanzo.ai Block Storage — realtime DO fleet + datastore fill (v8.4.151)

A GLOBAL-ADMIN board (Observe, beside Bots/Machines + Provider Billing) that answers
"how full is the analytics datastore, and how much DO block storage do we have" — so we
can scale DO storage BEFORE it runs out. One read: `StorageFleetApi.snapshot()` →
`GET /v1/admin/storage` (the same global-admin-gated aggregate as every other admin
board; `storage` added to `ADMIN_AGGREGATE_HEADS` + `next.config.mjs` `ADMIN_V1_HEADS`,
so it rides the `app/admin/aggregate` BFF standalone and cloud-native in the go:embed).

- **`StorageFleetModule`** (`components/products/admin/`, registry `block-storage`,
  `admin:true`) — a fleet KPI band (Volumes count · Provisioned capacity · Used · Monthly
  $), the analytics DATASTORE highlighted with a green/amber/red fill bar + near-full
  badge (the one number the operator scales on), near-full alerts, and the full volume
  list (fullest-first). Re-polls every 30s (realtime-ish). `lib/api/storage-fleet.ts` is
  the ONE reader (tolerant envelope unwrap + defensive normalizers).
- **Honest by construction:** DO's API gives capacity + attachment but NOT fill %, so a
  volume's used/pct render an em-dash "—" (`usedGiB`/`pct` are nullable, filled only where
  a filesystem source reported), NEVER a fabricated number; the datastore card shows only
  when `system.disks` actually answered.
- **Backend (paired, hanzoai/cloud `e0466a63b`):** `GET /v1/admin/storage`
  (`clients/admin/storage.go`, SuperAdmin `s.guard`) — the DO block-storage inventory
  (count · total · monthly cost · per-volume region + attachment) from a new paginated
  `Volumes()` on the existing `DO_API_TOKEN` client, PLUS the datastore's own fill from
  `system.disks` (the 200Gi PVC) over the SAME shared `aiobject.DatastoreQuery`
  the analytics/compute lenses use. Each source degrades independently; near-full raises
  an alert (warn ≥ 80%, critical ≥ 90%). Pure `buildStorageSnapshot`/`alertLevel`/
  `datastoreFillFromRow` unit-tested (4 Go tests green).
- Verification: `tsc --noEmit` clean (0 errors); e2e `storage-fleet.spec.ts` renders the
  datastore (200 GiB), fleet KPIs (295 volumes / $1,309), a 91% near-full alert, and the
  honest "—" — PASSES against the local fixture (primeSession owner:'admin'). Ships to
  admin.hanzo.ai via the next `hanzoai/cloud` release embedding `console@main`.

## Telemetry on the canonical @hanzo/event 0.3.1 — one /v1/event stream (v8.4.152)

Upgraded `@hanzo/event` `^0.2.0` → `^0.3.1`, the ONE telemetry client. Every signal
(pageview · product event · identify · error) rides one batched stream to the ONE Hanzo
Cloud front door `POST /v1/event`, lensed server-side into web analytics, product
insights, and error tracking — subsuming @sentry. The old 0.2.0 client posted the
deprecated `/v1/analytics` + `/v1/tracker`. The console was ALREADY wired at 0.2.0
(provider + a pageview/identify bridge + 5 product captures); this makes it canonical
and completes it.

- **ONE shared client** (`src/lib/event.ts`): `createAnalytics({ product:'console',
  host:'' (same-origin), ingestKey })`. `host:''` posts to the console's OWN `/v1/event`
  so the first-party session cookie rides along — the go:embed cloud binary serves it
  natively; the standalone BFF forwards it as the signed-in user (`event` added to
  `proxy-allow.ts` CLOUD_HEADS). The client NEVER sends an org — Cloud stamps the tenant
  from the validated session (fail-closed).
- **Error capture unified across the existing boundaries.** `captureErrors` is on by
  default (`window.onerror` + `unhandledrejection`) + beacon-on-unload. The three
  home-grown boundaries (`ProductErrorBoundary`, dashboard `error.tsx`, root
  `global-error.tsx`) now report React render errors — which React swallows before
  `window.onerror` — via `reportError()` to the SAME stream. The client is a module
  singleton precisely so the provider-less `global-error` (root layout torn down) reports
  too. A chunk-skew reload self-heals and is NOT reported (stale-deploy infra, not a bug).
- **Consent + PII.** PII-free by construction (anon id + the stable `owner/name` actor id,
  never an email; org never sent) and honors an explicit GPC / Do-Not-Track opt-out — the
  consent layer for logged-out/public views. Logged-out pageviews + errors ingest with an
  optional publishable key `NEXT_PUBLIC_EVENT_INGEST_KEY` (mint per org via
  `POST /v1/ingest/keys`); unset → logged-in via cookie, logged-out best-effort anonymous.
  The signin/public surface loads the client (it sits under the root `<Provider>`).
- **Product moments** (+3, atop PROJECT_CREATED · API_KEY_CREATED · PRICING_VIEWED/
  PLAN_CLICKED/CHECKOUT_STARTED · APP_CREATED/DEPLOY_STARTED · FIRST_ACTION):
  `AGENT_CREATED` (agent builder `onCreated` — the decoupled builder stays uncoupled),
  `CHAT_STARTED` + `CHAT_MESSAGE_SENT` (ChatConversation `send`; first turn starts, every
  turn sends), `SIGNUP_COMPLETED` (OnboardingWizard `finish`).
- **CTO gate (deploy, not code):** provision `NEXT_PUBLIC_EVENT_INGEST_KEY` for LOGGED-OUT
  ingestion; cloud must serve `/v1/event` (`clients/analytics/event.go`) — logged-in cookie
  flows already ride it. Reaches console.hanzo.ai on the next `hanzoai/cloud` release
  embedding `console@main`.
- Verification: `tsc --noEmit` clean; `vitest` 2933/2933 (233 files); `next build` ✓;
  `npm run build:embed` ✓ (go:embed gate; restored 30 route handlers). → v8.4.152.

## Block Storage — endpoint renamed; the REAL admin surface is the operator SPA (v8.4.153)

Correction to the v8.4.151 note above (which wrongly said "ships to admin.hanzo.ai via
console@main"). **admin.hanzo.ai is NOT this console** — it is `hanzoai/admin`
`apps/operator` (a Vite/React/hanzogui SPA, image `ghcr.io/hanzoai/admin`), the Operator
console, SEPARATE from console2. The docs elsewhere in this file claiming "admin.hanzo.ai
= standalone console2" are STALE. This console (embedded in the slim cloud binary) serves
**console.hanzo.ai / cloud.hanzo.ai** — the customer self-service surface; its `admin:true`
boards (Block Storage included) are the SUPER-ADMIN TWIN a global admin sees there.

- **Endpoint renamed** `/v1/admin/storage` → **`/v1/admin/block-storage`** (cloud
  9a51bffbc): DO block-volumes + datastore fill is a DIFFERENT concern from the operator's
  S3 object-buckets view, which keeps `/v1/admin/storage`. The console client
  (`storage-fleet.ts`) + the `ADMIN_AGGREGATE_HEADS` / `ADMIN_V1_HEADS` allow-lists + the
  e2e mock all moved to the `block-storage` head; the registry entry id was already
  `block-storage`.
- **The REAL admin.hanzo.ai page** is `hanzoai/admin` `apps/operator/src/pages/
  BlockStorage.tsx` (commit 30822a0) — same shape over the same `/v1/admin/block-storage`,
  built on `hanzogui` + `@hanzogui/admin` (SummaryCard/DataTable/Badge), route
  `/infra/block-storage`, Operations nav. Ships on the next `ghcr.io/hanzoai/admin` build
  (unblocked — separate repo). The cloud endpoint (the shared data source) ships on the
  next `hanzoai/cloud` release; this console twin rides the same release embedding
  `console@main`.
- Verification: `tsc --noEmit` clean; the block-storage e2e passes (renders datastore /
  fleet KPIs / near-full alert / honest "—"). → v8.4.153.

## platform.hanzo.ai is a deploy platform — native OSS App Store (1000+ one-click apps) + deploy home (feat/platform-oss-store)

platform.hanzo.ai was landing on the generic monochrome catalog home. The sibling
`972dfdc5f7` gave it the `platform` shell face (host → `shell:'platform'`, `/` → `/platform`);
this wave makes `/platform` a REAL deploy platform: a deploy HOME + a native OSS App Store
that ports the retired Dokploy marketplace (the 1000+-app `templates.hanzo.ai` catalog) into
the console, with one-click deploy over the console's OWN PaaS path and the maker "Earn 20%"
hook. Purely ADDITIVE — the committed single-product platform shell is respected, untouched
(no shell/registry-gate/test churn).

- **App Store product (`store`, category Platform)** — `StoreModule` browses the LIVE
  1000+-app catalog. `lib/api/oss-apps.ts` fetches `config.ossCatalogUrl`/meta.json
  (`https://templates.hanzo.ai`, default) DIRECTLY from the browser — the CDN sends open CORS
  (`access-control-allow-origin: *`, verified live), so it needs NO BFF and works in the
  go:embed console (where the Next reverse-proxies are pruned). Defensive normalizers over the
  exact live shape (`{id,name,description,version,logo,tags,links{github?,website?,docs?}}`;
  the extra `dokploy_version` is dropped; ids de-duped). Cached per base (one ~500 KB fetch
  shared by the store page + the home strip).
- **Search-first, DOM-safe (1030 items)** — pure `store/logic.ts` (node-tested): literal
  case-insensitive substring search (name/id/description/tags — ReDoS-safe, never a compiled
  RegExp), OR tag filter, quick-filter chips (FEATURED_TAGS present, provenance tags hidden) +
  an "All tags" reveal, and `slice(0, visibleCount)` "Load more" (PAGE_SIZE 48) so the mounted
  DOM is capped. `StoreCard` = lazy `<img>` logo (`<base>/blueprints/<id>/<logo>`) → a monogram
  fallback on 404 (never a broken image), version badge, tags, github/website/docs links.
- **One-click deploy over the console's REAL path** — `DeployDialog` reuses `PaasApi`
  (`/v1/platform/*`, the SAME container-app surface Compute › Applications drives; cloud
  `clients/platform`): ensure a project (a fresh auto-named one, or an existing one the user
  picks) → `createApp({source:'git', repo:{url: links.github}})` (Hanzo Cloud builds the repo
  with BuildKit) → `deploy` → honest build/live status + a link into the project's deploy hub.
  We do NOT rebuild the deploy backend; we drive it. An app with no buildable repo shows an
  honest "View app" (never a dead Deploy). Every phase is real; a failure surfaces the
  backend's own message.
- **Maker "Earn 20%" hook** — derived from `links.github` (there is no author field in the
  catalog) → `ownerRepo` → the IN-console OSS Author program (`/authors?claim=<owner/repo>`,
  URL-safe). Per-card ("Maintainer? Earn 20% →") + a page payout banner. The canonical 20%.
- **Platform deploy HOME** — `PlatformModule` '' now renders `platform-home/PlatformHome`
  (was the bare project list): a deploy hero ("Deploy anything."), quick tiles (App Store ·
  Containers · Functions · Usage), a FEATURED one-click-apps strip (the live catalog, curated
  to well-known apps, reusing `StoreCard`/`DeployDialog` via the shared `AppsRow`), and the
  org's real projects (the reused `PlatformList`, re-headed "Your projects" via new optional
  `title`/`subtitle` props). `:name` → `PlatformDetail` unchanged. So platform.hanzo.ai boots
  into a deploy platform, not a generic console.
- **Home "Deploy OSS" tile → native `/store`** (was an external `window.open(templatesUrl)`) —
  the marketplace is now native for every host. `config.ossCatalogUrl` added (env
  `NEXT_PUBLIC_OSS_CATALOG_URL`, default `https://templates.hanzo.ai`).
- **White-label**: all deploy/store copy reads `config.brandName` (a Lux console says "Lux
  Cloud", never "Hanzo").
- **RENDER-proven, not just mocked** (`e2e/platform-store.spec.ts`, mocked catalog + PaaS,
  local dev): `/store` renders the grid, search narrows to Postgres (n8n disappears), the
  Deploy dialog opens over the real PaaS path ("Deploy n8n" · `n8n-io/n8n` · New-project
  selector), and the "Earn 20%" hook shows; `/platform` renders the deploy hero + App Store
  tile + featured OSS strip + Your-projects. Screenshots `e2e-shots/{store-grid,store-deploy,
  platform-home}.png`.
- **Reachability (flagged, honest):** the catalog is LIVE (CORS `*`, 1030 apps) → the store
  renders real apps today. Deploy hits cloud's `/v1/platform` (the live PaaS `PaasApi` used by
  Applications) — a signed-in org's real create→build→deploy; honest error/empty states if a
  repo doesn't build cleanly (the backend's own verdict, never fabricated). No new backend
  endpoint — the catalog is a public CDN, deploy reuses the existing platform subsystem.
- Verification: `tsc --noEmit` clean (0 errors); `vitest` **all green** (+24 new:
  oss-apps normalizers/URL/ownerRepo/claim + store filter/paginate/tags/featured/slugify);
  `next build` ✓; `npm run build:embed` ✓ (go:embed gate — the surface platform.hanzo.ai
  serves; adds no routes/dynamic pages). ADDITIVE only — the committed `platform` shell
  (single-product face) is untouched. NOTE (deploy): ships to platform.hanzo.ai/
  console.hanzo.ai on the next `hanzoai/cloud` release embedding `console@main`
  (`CONSOLE_REF=main`, go:embed) — no standalone console image reaches those hosts; the
  release/merge agent bumps `package.json` + the cloud release embeds it. FOLLOW-UP (optional,
  not done to respect the committed design): upgrade the `platform` face from single-product to
  a MULTI-product category-scoped nav (Platform · Compute · Network) so the sidebar itself
  leads with Projects/Containers/App Store/Functions/Usage — a shell.ts + registry-gate change,
  a separate CTO call.

## Logged-out landing chrome — reachable footer, ONE typeface, ONE sign-in (v8.5.29)

A rendered-DOM audit (CDP + hit-testing) of the LIVE `cloud.hanzo.ai` at 390x844 and
1440x900 found three defects in the anon landing's chrome. Root causes, measured — not
inferred:

- **Footer legal links were CLIPPED off-screen and unreachable at 390px.** The link
  clusters are Views (`flex-shrink: 0`), so they held their max-content width and their
  own `flex-wrap` never engaged: "Terms" painted at x 397→435 on a 390px viewport, and
  `html,body{overflow-x:clip}` means `documentElement.scrollWidth` stays 390 — the
  overflow is CLIPPED, not scrollable, so a legally-required link could not be reached
  by any gesture. Already fixed in `ConsoleFooter` by `2fc59f4cad` (`flexShrink: 1` on
  every wrapping cluster, so `flex-wrap` engages); this wave LOCKS it with the geometry
  spec below, because the clip makes it invisible to `scrollWidth` and to every unit
  test. Measured after: the row wraps to two lines, Terms at x 149→187, nothing painted
  past the right edge. The fix is WRAP — the page body must never scroll sideways.
- **Header chrome rendered in a SYSTEM font while the body rendered Geist.** The shared
  `@hanzogui/shell` chrome sets its own stack as an INLINE style on its root
  (`fontFamily: CHROME.font` = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", …`,
  which names no Geist) and its subtree inherits it (its buttons re-declare
  `font-family: inherit`). Measured on live: wordmark `Noto Sans:11:SYSTEM`, nav links
  `Noto Sans:9:SYSTEM`, hero `Geist:26:custom` — mixed typography on one screen. Geist
  loads fine (self-hosted woff2, `app/fonts.css`), so this is a CASCADE problem, not a
  loading one, and the font loading is untouched. Fixed console-side (the shell is
  another repo) with ONE rule in `app/globals.css`: `[data-hanzo-shell]` + its
  descendants pinned to `var(--font-sans)`. `!important` is required — nothing else
  beats an inline declaration — and matches the existing `font-synthesis` invariant
  right above it. `code/pre/kbd/samp` keep the mono face, so the two font invariants
  stay orthogonal. Measured after: nav `Geist:9:custom`, Meet-Hanzo `Geist:10:custom`,
  CTA `Geist:7:custom` — identical to the body's own face.
- **TWO "Sign in" affordances in the desktop logged-out header.** `HanzoHeader` renders
  its OWN account link whenever `account` is nullish (`account ?? <DefaultAccount/>`),
  and `landingSurface` already relabels the primary CTA "Sign in" — so live read
  `[Get API key] [Sign in (filled, /signin)] [Sign in (plain, href="#")]`; the duplicate
  was also a dead link. `PublicLanding` now declines the control explicitly
  (`account={NO_ACCOUNT}`, i.e. `false` — not nullish, so the default never renders, and
  React draws nothing, including the mobile sheet's identity row). Exactly ONE sign-in.
- **RENDER-proven, not just mocked** (`e2e/landing-chrome.spec.ts`, anon by
  construction — every API call answers 401 so the public landing mounts): at 390 every
  footer link's box is inside the viewport AND hit-tests to itself,
  `documentElement.scrollWidth === clientWidth`, and NO element is painted past the right
  edge; the header chrome reports the same Geist face as the body via CDP
  `CSS.getPlatformFontsForNode` (`document.fonts.check()` is worthless as evidence — it
  answers true on a page with zero `@font-face` rules); and the header carries exactly
  one "Sign in", the filled primary (`rgb(255,255,255)`), with none at 390 (collapsed to
  the disclosure button). Screenshots `e2e-shots/{landing-footer-mobile,
  landing-header-desktop}.png`.
- Verification: `next build` ✓ ("Compiled successfully in 8.6min", types + 20/20 static
  pages); `tsc --noEmit` clean; `vitest` all green; `landing-chrome` 3/3 against the
  PRODUCTION build on `next start`. Negative control for the font rule: deleting it from
  the CSSOM on the same build reverts the header to `Noto Sans:9:SYSTEM` with the stack
  `ui-sans-serif, system-ui, -apple-system, "Segoe UI"` — so that one rule is
  demonstrably the fix, in isolation.
- NOTE (deploy): both `cloud.hanzo.ai` and `console.hanzo.ai` were measured serving a
  build that predates `2fc59f4cad` (hero still a `SPAN`, two sign-ins), so main is AHEAD
  of production on both hosts. The console FE reaches prod by bumping the console image
  tag on the universe operator CR (ArgoCD syncs it) — a code push alone does not deploy.
  These fixes are LANDED, not live, until that tag bump.

## One app search — Apps and ⌘K converge (v8.5.30)

- Removed the fullscreen app launcher and its duplicate product filter.
- The header Apps button, mobile Apps button, search field, and ⌘K now open the
  same `CommandPalette`.
- An empty query is the browse state: products are grouped by category in a compact
  two-column desktop grid and a one-column mobile list. Typing switches to ranked
  commands, products, and product sub-pages without changing overlays.
- `>` remains the AI mode and `?` remains the documentation mode. Keyboard
  navigation, Enter, Escape, and the mobile full-screen layout remain intact.
- Integrated the concurrent category-accent restoration: one accent per category,
  neutral chrome, user overrides still win. Removed its duplicated swatch array and
  updated the color contract tests.

## Canonical main convergence (v8.5.31)

- Merged the newer forge guide, pitch, signal, and route work into the same main
  after v8.5.30, preserving the unified app search and category accents.
- Verified the combined tree: strict typecheck, 3,044 tests, and the production
  Next.js build all pass.

## One paper, one leading — overlay elevation and display type (v8.5.32)

Two rendering contracts were silently not applying. Both were found by measuring
computed styles in a real browser, not by reading code.

**The product-guide headline had a 1px line box.** `PitchHero` set
`style={{ lineHeight: 1.12 }}` — a correct, idiomatic ratio in plain React, because
React DOM's unitless allow-list includes `lineHeight`. React Native Web's does NOT
(`StyleSheet/compiler/unitlessNumbers.js`), so under @hanzo/gui it compiled to
`line-height: 1.12px`: a 30px/900 headline in a 1px box, a 29px overflow that dropped
its descenders into the subhead and clipped the GET STARTED eyebrow above it. It now
wears `hz-display`, the class this app already uses for exactly this (PublicLanding,
v8.5.24) — one way, one rule, every size token and breakpoint. Measured after: 30px
type on 33px leading at desktop, clean two-line wrap at 390px.

`e2e/leading.spec.ts` pins the INVARIANT rather than the call site: no visible text
node on /models, /agents or /playground may compute a `line-height` smaller than its
own `font-size`. That catches the next numeric `lineHeight` anyone writes without
their having to know about RNW's allow-list. It fails on the unfixed tree.

**No overlay was wearing the elevation ladder.** Gui compiles its shadow props to an
atomic rule it injects at runtime as `:root ._bxsh-…` — specificity (0,2,0). The
design-token utilities were plain `.hz-paper` (0,1,0) and lost, so the command
palette, app launcher, floating chat and three menus rendered Gui's
`0 12px 24px rgba(0,0,0,.33)` instead of ring + top highlight + `--hz-elevation-3`.
On the true-black canvas that shadow is nearly invisible — the sheets did not lift off
the page. The utilities are now `:root .hz-x.hz-x` (0,3,0): deterministic in either
stylesheet order, no `!important`.

**And every anchored overlay now wears ONE surface.** Eleven `Popover.Content` call
sites passed Gui's `elevate` while three wore `hz-paper` — one concept, two depths,
plus the same `bordered`/`bg`/`borderColor` triple repeated fourteen times. All
fourteen now spread `~/components/ui/paper`, which holds the surface, the token
elevation and the opacity-only `hz-menu-in` entrance in one place. Verified rendering
on the scope switcher, the network picker, the model selector, the save-prompt
popover and the ⌘K palette: opaque, correctly anchored, ring visible, nothing occluded.

## ONE level-2 nav — the registry declares it, the sidebar renders it (feat/one-second-level-nav)

Clicking into a product revealed its options TWICE. The sidebar drilled into the
product and rendered its sub-nav from the registry (`productSubpages`), and the
module ALSO rendered a private `const TABS` strip in the content column. The two
lists were written independently and disagreed: `/models` showed eight rows in the
rail and four tabs in the content, and they did not even agree on what the index is
called — the rail said "Overview", the module said "Catalog". Eight products
(Containers, Fine-tuning, Tasks, Team, Settings, Zero Trust, Evals, Analytics)
declared NO sub-pages at all, so their real tabs existed only in the content strip
and the rail hid them.

- **The registry is the one source.** `CatalogEntry` gains `indexLabel` — what a
  product calls its own index when it is a named surface rather than a summary
  (Models → Catalog, Tasks → Workflows, Team → Members, CRM → Companies, Cap Table →
  Summary, Evals → Run, Containers → Workloads, Fine-tuning → Jobs, Automations →
  Flows, Profile → Account, Settings → General). `productSubpages` reads it, so the
  rail, `SubNav`, and ⌘K all say the same word. The eight products missing `subpages`
  now declare them; the icons the strips were carrying moved onto the declarations.
- **`components/ui/SubNav.tsx` is the ONE strip**, rendered from `productSubpages` and
  hidden at `lg+` (`$lg={{ display: 'none' }}`) because the sidebar owns level 2
  there (then `DrillNav`; now `SubRows` — see "The rail stopped drilling" below). One declaration, two mounts — never two navs painting at once. It
  takes an optional `href` for a product whose tabs carry URL state (Containers keeps
  its `?cluster=` selection across tabs). `subpageIcon` moved here and `dashboard.tsx`
  imports it, so the sub-page icon defaults exist once.
- **Level is the URL and nothing else.** New pure `activeSubpage(pathname, id)` (the
  level the URL is on, `''` = index) + `subpageHref(id, slug)` (one URL per screen) +
  `subpageSlug(entry, seg, showAdmin)` — the validator that replaced every module's
  `TABS.some(...)`, so a hand-typed `/tasks/bogus` cannot light a tab the module does
  not render, and an admin-only sub-page (Models › Routing) cannot be offered to a
  customer. Bound to the live registry as `productSubpageSlug` in `match.ts`.
- **18 modules lost their private `TABS`** (Models, Evals, AI Accounts, Containers,
  Analytics, Fine-tuning, Team, Automations, Embeddings, Tasks, Functions, Profile,
  Router, Settings, Zero Trust, Billing, Cap Table, CRM, Infrastructure) — plus their
  bespoke `TabButton`/`TabBar`/`nav`/`path`/`tabPath` helpers. Net −200 lines.
- **Functions had two indexes.** Its `''` route pointed at a `livingOverviewModule`
  while `FunctionsModule` carried a second, older `OverviewTab` reachable only via a
  bogus URL — and because the index was not the module, `/functions` had no level-2
  nav at all on a phone. Now ONE component owns the product at every level and renders
  the living-overview board as its index; the dead `functions/OverviewTab.tsx` is gone.
- **`/crm/companies` was a duplicate URL** for the screen `/crm` already renders. The
  index IS Companies now (one URL per screen); the old path still resolves.
- **One placement, measured.** The strip renders under the page header, never inside
  `PageHeader`'s actions slot: a View is `flex-shrink: 0` with `min-width: auto`, so
  in a row it held its max-content width, its own `flex-wrap` never engaged, and at
  390px the last tabs painted past the right edge (the same bug `ConsoleFooter` had).
  It carries `style={{ flexShrink: 1 }}` + `minW={0}` for the same reason.
- **Not converted, and why:** Playground, Machines, Kubeflow, Cloudflare, Growth,
  Providers-Explore and the Errors status filter keep local-state tab strips. Those
  are NOT a second level-2 nav — they are in-page view switches the URL never carried,
  so converting them changes routing behaviour per product rather than removing a
  duplicate. They are the honest follow-up: their level does not survive a reload.
- Verification: `tsc --noEmit` adds zero errors (the one reported, `src/lib/event.ts`
  `dsn`, is pre-existing local dep drift — `@hanzo/event` 0.3.1 installed against
  `^0.3.4` — and reproduces on a clean origin/main tree); `vitest` **3093 passed**
  (+9 level-2 nav: indexLabel, the validator incl. the admin gate, one-URL-per-screen,
  and the URL→level read); `next build` compiles (its type step stops on that same
  pre-existing drift). RENDER-proven in a browser, `e2e/level-2-nav.spec.ts`, 5/5
  against a local server: at 1440 the rail is drilled and the content strip's
  COMPUTED `display` is `none` (a hidden element leaves the accessibility tree, so it
  is located by test id — `getByRole` cannot see it, which is the whole point); at 390
  the strip is the one nav, lists the same labels, every tab has a painted box ≥28px
  tall inside the viewport, and the body does not scroll sideways; a reload of
  `/models/blend` lands on Blend; Back moves the LEVEL without dropping the rail's
  drill or the account-backed pins; and a sweep asserts all 18 converted products
  paint no second nav. Screenshots `e2e-shots/level2-{desktop,mobile}-models.png`.
## Find and do — one list view, pins that survive, a palette you can act in

The interaction half of the admin redesign: pin, sort, filter, search, act. Almost
none of it was missing; it was duplicated, unpersisted, or quietly broken. Every
claim below was measured in a browser on computed style and geometry
(`e2e/find-and-do.spec.ts`, 7 tests), not inferred.

**[BUG, measured] Every preference was lost on reload.** Pin a product, reload, and
it was gone — and with it pin groups, product colours, the nav's open sections, and
the workbench state. `Preferences` treated the account as authoritative for keys it
had *never mentioned*: on each account load it replaced both state and the
localStorage cache with `parsePrefs(account.properties['hanzo.preferences'])`. But
the account is projected from the IAM access token's claims, and a preference
written after sign-in is not in a token minted before it — so that value is `{}`,
and the write-through cache was destroyed on every load. Only preferences rewritten
each session (e.g. `guide.used`) appeared to persist. Fix: the account wins for
every key it CARRIES; the cache fills the rest (`preferences-core.mergePrefs`, pure,
7 tests). Stated limit, not papered over: while the account does carry a key it
wins, so clearing it on one device can be re-asserted by a stale token — closing
that needs a read-back of stored preferences (a fresh account read, or properties
riding a refreshed token), which is a session/backend concern.

**ONE list view, persisted per user** (`src/lib/list/`). `useList(id)` holds a
list's search, column order and facets under `list.<id>` in the SAME account-backed
store as pins — so a list narrowed once is found narrowed on the next visit and the
next device. The comparator, header-click reducer and substring predicate are NOT
new: they were promoted verbatim out of the private copy inside `admin/infra/`,
which now re-exports them, so there is one implementation (its 30 tests pass
unchanged). `nextSort` is a strict superset of the shipped reducer — it only also
accepts `null` as "no sort yet" — so no shipped board changes behaviour. `Filters`
(in `ui/Filters`, beside its own atoms) is the one bar: search, facets, and a Reset
that exists only while something is narrowed. A facet is stored only when it
narrows something; "All"/"off" is the ABSENCE of a facet, never a stored sentinel.
Adopted by Models and Marketplace, which between them lose two bespoke search boxes
and four `useState`s. Scope, flagged not decided: preferences are per USER, so a
SuperAdmin masquerading keeps their own sorts — right, I think (they are YOUR
tools), but it is a product call.

**Pins are first-class in search.** `pinnedFirst` (pure, in `pins-core`) is the one
"pinned leads" rule, shared by the sidebar and the palette. Every ⌘K result carries
a pin at its right edge — invisible until the row is reached, lit while pinned, a
26px hit target, `aria-pressed` — and `⌥↵` pins the selection WITHOUT closing, so
curating is repeatable. The default view collects pins under one leading "Pinned"
heading.

**[BUG I introduced, then caught] Pins must not outrank what you typed.** Applying
`pinnedFirst` to the RANKED list meant a barely-matching pinned product beat an
exact name match: typing "billing" and pressing ↵ opened Models. Pins now order the
DEFAULT view only; the moment you type, relevance decides. Locked by a test that
asserts on where you LAND (`agents`→/agents, `billing`→/billing, `vector`→/vector),
not on DOM order.

**[BUG] The resting pin painted at full strength.** `.hz-pin { opacity: 0 }` lost to
Gui's compiled `:root ._ops-…` (0,2,0) — the same specificity trap `.hz-paper` hit.
Fixed by dropping the inline `opacity` prop and doubling the selector
(`:root .hz-pin.hz-pin`). A broken CSS comment then silently killed the whole rule;
only the computed-style assertion caught it. Both are now pinned by a test that
reads `getComputedStyle().opacity` at rest, on hover, and while selected.

Verification: `tsc --noEmit` clean; `vitest` **3121 passed** (+35: list core 22,
preferences-core 7, pinnedFirst 6); `e2e/find-and-do.spec.ts` 7/7 against a local
fixture with screenshots (`palette-pin`, `palette-pinned-first`, `palette-keyboard`,
`list-narrowed`, `list-bar-mobile`), including 4.5:1 contrast and zero horizontal
body scroll at 390px. NOT verified against live admin.hanzo.ai — it is auth-gated
and I will not type a password; one SuperAdmin session re-running this spec closes
that. Untouched and flagged for the caps pass: `MarketplaceModule`'s "CATEGORIES"
and the palette's own uppercased section labels are `textTransform` sites that
belong to that lane, not this one.

## Billing calls the route names the server actually registers

Commerce dropped the compound prefixes from its billing routes — the `/v1/billing/`
namespace already says "billing", so `billing/payment-methods` stuttered. Both servers
register only the short names, measured against the live edge: `/v1/billing/methods`
401, `/v1/billing/settings` 403, `/v1/billing/alerts` 403, while `payment-methods`,
`payment-config` and `spend-alerts` are all 404. The console never followed. Its card
reads, its card writes and its Square-config read were all addressed at routes that no
longer exist, so a new user could not add a card — the revenue path was broken in
production.

The client had already been repointed for alerts, so `payment-methods` (list, save,
detach) and `payment-config` were the ones still dead. They now build `methods` and
`settings`. There is deliberately no alias and no fallback: one name per concept.

The tests were part of the defect, not the safety net. Every suite around payment
methods stubbed a response body and asserted the normalization, so a client pointed at
a 404 stayed green — the exact reason this survived. The URL is now pinned where the
request is actually made, including the two reads nothing had ever asserted
(`methods`, `settings`) and `alerts` beside them. Reverting any of the four short names
turns the suite red, which was checked rather than assumed.

`POST /v1/billing/me/welcome` and everything feeding it is deleted, not repointed.
Commerce removed that route on purpose: it was a self-service mint, a browser could
grant its own org $5, and commerce's own `api/billing/mint_gates_test.go` names it the
TOCTOU double-mint. Credit is minted only through the mint-gated `POST
/v1/billing/credit`. The call had been failing silently, so restoring it would have
re-opened a closed money hole to fix nothing. The trial credit still lands — commerce
grants it server-side when a card is vaulted, and signup grants it server-side — and
that path is untouched. `src/lib/billing/welcome.ts` had no callers left at all.

Scope, checked rather than assumed: `/v1/finance/payment-methods` is still 401 (alive)
and `/v1/finance/methods` is 404, so the finance ledger keeps the compound name — a
blanket repo-wide rename would have broken it. The Billing Center's tab slugs
(`/billing/payment-methods`, `/billing/credits`) are console page URLs, not server
routes, and are unchanged.

Two headlines were lying about which layer failed. "Card top-up isn't available on this
deployment yet" and "Adding a card isn't available on this deployment yet" both fire
when the ORG has no Square `applicationId`/`locationId` — a per-organization
configuration, not a property of the deployment. Both now name the organization, as
does the onboarding step's "Payments aren't set up", which had the same defect. The
stale `GET /v1/billing/payment-config` endpoint hints under those cards now read
`settings`.

## The assistant has one home, and the app directory is one you can walk

Three fixes to the console's own chrome. Each root cause was measured in a browser
on computed style, geometry or where the browser lands — never inferred from source.

**The assistant lived in a third place.** `FloatingChat` owned every shape the
assistant can take (the sheet, the docked column, the dock state) except the way
in, which was two small buttons in the TOPBAR — a brand-H "Chat with Hanzo" and a
"Talk to Hanzo" mic — wedged between the search box and the org/theme/alert
cluster. On a 390px phone that put five controls in the header and squeezed the
search field to "Search or jump…". Both controls moved into `AssistantFab`, one
floating cluster fixed bottom-right, in the corner the assistant actually appears
in. Chat and voice are the same surface opened two ways, so they sit together.
Nothing about the assistant was rewritten: the FAB calls the same `openChat` /
`startVoice` the topbar called, and `open`/`toggle`/`ask` still drive it
programmatically (the Code hub's "Ask AI").

It is suppressed exactly where the assistant is already on screen — while the
sheet is open, on the pages that ARE a composer, and, at `lg+` only, while it is
docked as a column. That last half is a CSS media prop rather than a JS branch so
SSR and first paint agree, and it sits above the Developers dock (whose collapsed
bar is 44px and exists only at `lg+`).

**[BUG, measured] All products was a directory you could not walk.** The pane that
lists every Hanzo app — the sidebar's "All products", the one place the whole
catalog is browsable — rendered each app as an inert `XStack`: a plain `DIV` with
`role=null` and `cursor: auto`, no handler, no pointer affordance. Measured, not
read. The only live control in the row was the pin, so a user could curate the
sidebar but could not open anything from the list. The row now opens its app
through the shared `openProduct` — the ONE opener the sidebar, ⌘K and the category
pages already route through — and closes the pane behind it, because a directory is
not a destination. Pin stays a separate control on the same row and stops the press
from bubbling: curating never navigates, navigating never curates.

**[BUG] A pin made after sign-in was thrown away on the next reload.** Preferences
are read off `properties['hanzo.preferences']` in the IAM access token's claims — a
SNAPSHOT taken when that token was minted. An earlier lane fixed the case where the
snapshot is SILENT about a key. The other half was never closed: once a user has
saved anything, the next token CARRIES a snapshot, and the merge let it win over a
newer local write. So the second pin onward read as pinned and was gone after F5.

The merge is now told the ordering it was missing. `Account` carries the token's
own `iat`; the provider stamps `…prefs.<user>.writtenAt` when — and only when — the
SERVER acknowledges a write; `mergePrefs(cached, fromAccount, order)` lets the cache
win only when a confirmed write is newer than the snapshot. Last writer wins, and
both writers are now identifiable. A fresh device (no cache, no stamp) and a fresh
sign-in (token minted after the write) both still take the account wholesale, so
cross-device is preserved. Stamping only server-confirmed writes is what keeps this
from being localStorage impersonating a backend: a save that never landed earns
nothing and the account stays authoritative.

**Backend gap, named rather than papered over.** There is no READ for this
document. `PATCH /v1/ai/preferences` (hanzoai/ai `UpdatePreferences`) writes it to
the IAM user's `properties['hanzo.preferences']` and returns the merged result;
nothing serves a GET, so the token's snapshot is the only read the console has. The
smallest seam that removes the ordering problem entirely is `GET
/v1/ai/preferences` returning that property after the handler's existing
`refreshSessionUser` — the write path already does every part of it. Better still
is `GET/PATCH /v1/prefs` (hanzoai/cloud `apps/prefs`), the canonical cross-surface
plane, which answers 503 on api.hanzo.ai today.

**House rule: one filled CTA.** Counted by computed background luminance on the
rendered home, not by reading JSX: FIVE white-filled buttons competed — "Take the
tour", the getting-started card's active step, and all three `PrimaryActionTile`
CTAs (two of them saying "Get API key"). The same measurement now returns ONE: the
checklist's ACTIVE step, the thing to do next. The tour is a neutral aside beside its
dismiss, and the three tiles are neutral because they are PEERS — a menu of things
you can do, not a call to action, and three primaries are none.

**Verification.** `tsc --noEmit` clean; `vitest` 3175 passed / 8 skipped (256 files,
+6 ordering tests). RED→GREEN proven both ways: disabling `cacheIsNewer` turns the
two new ordering tests red and the browser test with it. `e2e/assistant-fab-and-apps.spec.ts`
(4 tests, 1440 and 390) asserts the control's BOX is in the bottom-right quadrant and
≥44px, that `.hz-topbar` carries no assistant control, that clicking an app in All
products LANDS on `/agents`, and that a pin survives a reload under a token whose
snapshot is an hour old. `e2e/chrome-brand-voice.spec.ts` was retargeted, not
deleted — every claim it made still holds, only the location moved.

Two spec gotchas worth keeping. `_session.ts`'s `b64` emitted plain base64; that is
fine while a forged payload is tiny, but `+`/`/` appear as soon as one grows (a
`properties` bag is enough) and a strict decoder rejects the token outright — the SDK
reports signed out and the app sits on its loader forever. It emits base64URL now,
which is what a JWT segment actually is. And the assistant's composer carries its own
mic with the same `Talk to Hanzo` label, mounted-but-hidden until the panel opens, so
a bare attribute locator matches that one first: scope to `getByTestId('assistant-fab')`.


## The agent quickstart, and the rail that stopped drilling (v8.5.62)

Two changes that share a shape: something that looked finished was standing in for
the thing itself.

**The builder had no way in.** `AgentBuilder` — the canonical, host-agnostic one —
was reachable only as a form in a side pane, from a board you first had to have
agents to be looking at. `agents/quickstart` is the way someone with none starts:
describe what you want in a sentence, or take a template, then configure, run and
integrate.

- **Every step is an endpoint**, which is the whole design constraint. Describe →
  `POST /v1/chat/completions` (`draftAgent`) turns a sentence into a spec; Configure →
  the SAME `AgentBuilder`, seeded; Run → `POST /v1/agents/:ref/run` executes it and
  shows the RECORDED run; Integrate → prints the request that just worked. A ladder
  of steps is a promise about what happens, and a step that only draws a checkmark
  turns the promise into decoration. Steps 1 and 3 are optional by construction —
  their loaders may be absent, and the step then says exactly what is missing.
- **`components/agent-builder/templates.ts`** — eight presets, pure data. A template is
  a PRESET, never a promise: it may only carry fields `toCreateBody` already expresses
  (`name`, `description`, `systemPrompt`, and the real `AgentConfig` knobs), and a test
  pins exactly that. **None names a tool.** Tools are per-org, so a hardcoded
  `web.search` would name something that may not exist and would fail at the agent's
  FIRST invocation rather than in the form. What a template CAN say truthfully is
  `useTools` / `webSearch`, which are real switches in the agent contract.
- **The tool plane was live the whole time.** `loaders.ts` said "No live tool catalog
  endpoint on this deployment yet" and left the field typeable-only. `GET /v1/tools` is
  bound and serving — one flat set spanning connector actions, functions, zap-service
  routes, agents, skills and the org's own MCP servers, deduplicated by name, each
  flagged `activated`. `lib/api/tools.ts` reads it, `proxy-allow` admits the head, and
  `/v1/tools/call` is REFUSED there: running a tool belongs to whatever runs an agent,
  never to a browser tab. An org with nothing activated gets `{"tools":[]}` — a real
  empty answer, shown honestly rather than papered over.
- **`defaultModel` was picking an embeddings model.** It named `zen-omni` as its exact
  match, and the live catalog does not carry that id — so the exact arm never fired and
  the fallback ran instead: `^zen[-.]` over an alphabetically sorted catalog, which
  selects `zen-embedding`. Every agent created without touching the model field was
  pointed at a SKU that cannot hold a conversation, and nothing caught it because the
  dead exact-match read like the rule. The family test is `^zen\d` now, because zen's
  naming splits cleanly: **`zen5*` are the text models; `zen-<noun>` names a MODALITY**
  (embedding, image, video, rerank, voice, vl, guard). The model and tool placeholders
  were advertising the same dead id and two invented tool names; both now say things
  that exist.

**The rail stopped drilling.** Clicking a product used to swap the ENTIRE sidebar for
that product's sub-nav, behind a "Back to all products" button. The options were
identical either way — what the drill took away was every OTHER product, which is
precisely what someone needs when the reason they opened the rail was to go somewhere
else. `SubRows` replaces `DrillNav`: a product's sub-pages expand beneath its own row,
indented on a hairline, `inert` when collapsed.

- **The label navigates; the chevron only opens and closes.** One target doing both
  would make "show me what is in here" and "take me there" the same gesture.
- `productIsOpen` / `toggleProduct` in `nav-accordion.ts`, beside the category pair and
  keyed apart from it. The default is the OPPOSITE of a category's, deliberately:
  categories are few and describe the catalog, so they open; products are many and each
  brings four to eight rows, so opening them all would bury the catalog under its own
  detail. The product you are IN is open unless you closed it, and that choice persists.
- **A pinned product appears twice** — once under Pinned, once in its category — and
  exactly ONE copy may carry the sub-list. Two copies is two navs painting at once,
  which is the thing this rail exists to avoid, and it doubles the rail's height for no
  information. The pinned copy owns it.

**Verification.** `tsc --noEmit` clean; `vitest` **3259 passed / 8 skipped** (262 files;
+draft/handle parsing, +templates, +the product accordion, +the tool-plane allow/refuse
pair, and a `defaultModel` test that goes red on the `zen-embedding` regression).
RENDER-proven: `e2e/agent-quickstart.spec.ts` (3 tests) asserts the ladder, that the
gallery sits to the RIGHT of the composer by measured geometry at 1440, that searching
narrows it, that picking Deep researcher carries its handle and prompt into step 2, and
that 390 stacks without the body scrolling sideways. `e2e/level-2-nav.spec.ts` (5/5) was
retargeted, not deleted: it now asserts "All products" is still on screen while a
product is open — the invariant the drill could never have satisfied — and that no
"Back to all products" button exists on any of the 18 converted products.

**ONE door.** The board's New-Agent button opened the builder in a side pane —
the same component, reached by a different shape, with no templates, no drafting,
and nowhere to run what it made. It goes to the quickstart now and
`NewAgentForm` is deleted; two entrances to one builder is two things to keep in
step, and the pane was the lesser of them. A spec clicks the board's CTA and
asserts the URL lands on `/agents/quickstart`.

One placement note that cost a debug cycle: the quickstart branch must return BEFORE
`AgentsModule`'s loading/error/empty states. Building an agent does not depend on
reading the ones that exist, and the moments you most need the quickstart — no agents
yet, or the registry not answering — are exactly the ones those early returns swallow
it in.
