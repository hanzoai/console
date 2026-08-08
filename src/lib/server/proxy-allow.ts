/**
 * Least-privilege allow-lists for the same-origin user-bearer proxies (pure, tested).
 *
 * Each proxy mints a user-bound Bearer and forwards to a backend; the JWT owner
 * claim scopes tenancy server-side, so these lists are DEFENSE IN DEPTH — they keep
 * a proxy from becoming a general tunnel to everything the cloud-api or visor binary
 * mounts (e.g. `/v1` must never reach `v1/iam/*` or admin endpoints).
 */

/**
 * Cloud-api `/v1/<head>` surfaces reachable through `/v1` as the signed-in user.
 * These are exactly the data + serverless products whose backends authorize on the
 * Bearer owner claim (and 403 a cookie-only call): the seven managed data resources
 * plus the serverless / prompt / agent surfaces.
 */
export const CLOUD_HEADS: readonly string[] = [
  // Managed data resources (provisioning service) — one REST head per kind.
  'sql',
  'vector',
  'datastore',
  'kv',
  'search',
  's3',
  'docdb',
  // DNS control plane (hanzoai/dns at dns.hanzo.ai): /v1/dns/{zones,sync}[/…]. The
  // consolidated DNS service — authoritative zones served by CoreDNS plus
  // third-party providers (Cloudflare) via the org's KMS-sealed token. The
  // service validates the IAM JWT and scopes every zone/record to the owner claim,
  // and 403s a cookie-only call, so it routes through /v1 exactly like the data
  // resources.
  'dns',
  // Serverless + prompt/agent/eval surfaces (org resolved from the Bearer owner claim).
  'functions',
  'prompts',
  'agents',
  // The unified tool plane (cloud apps/tools): /v1/tools — discovery across every
  // source (connector actions, functions, zap-service routes, agents, skills, the
  // org's own MCP servers), deduplicated by name. `scopeOf` derives the org+project
  // from the Bearer owner and 403s a cookie-only call, so it routes through /v1
  // exactly like agents/prompts. Discovery only — `/v1/tools/call` is refused below,
  // because running a tool belongs to whatever runs an agent, not to a browser tab.
  'tools',
  // Login manager (cloud clients/link): /v1/links[/…] — the org+user-scoped registry
  // of which AI provider accounts are signed in on which machines + their usage. The
  // handler resolves org from the Bearer owner + the user from the validated subject
  // and 403s a cookie-only/forged call, so it routes through /v1 like agents/prompts.
  'links',
  // Automations (cloud clients/automations): /v1/automations/{pieces,flows,runs,mcp}[/…].
  // The ONE native Connectors + Automations engine — flows/versions/runs over the
  // go:embed'd 706-connector catalogue, run durably on the shared hanzoai/tasks engine.
  // The handler resolves the org from the Bearer owner (principal.Tenant) and 403s a
  // cookie-only or forged-header call, so it routes through /v1 exactly like
  // prompts/agents — the single `automations` head admits every sub-path (pieces,
  // flows CRUD + enable/disable/run, runs, mcp). Replaces the retired /v1/auto proxy.
  'automations',
  // Webhooks (cloud clients/webhooks): /v1/webhooks[/:id[/{deliveries,test,secret}]].
  // The org's outbound event destinations — the handler resolves the org from the Bearer
  // owner (principal.Tenant) and 403s a cookie-only or forged-header call, so it routes
  // through /v1 exactly like automations/agents. The single `webhooks` head admits every
  // sub-path (endpoint CRUD + enable/disable, per-endpoint deliveries, test-send, rotate).
  'webhooks',
  // Framework (cloud clients/framework): /v1/framework/{doctypes,roles,modules,:doctype}[/…].
  // The metadata-driven DocType engine — the FOUNDATION CMS/ERP/CRM/Helpdesk are "just
  // DocTypes" on. Per-org on Base/SQLite; the engine derives the org from the Bearer owner
  // (principal.Tenant) and 403s a cookie-only or forged-header call, so it routes through
  // /v1 exactly like prompts/agents — the single `framework` head admits every sub-path
  // (doctypes, roles, modules install, and the generic /:doctype document CRUD).
  'framework',
  // Knowledge (cloud clients/knowledge): /v1/kb/{graph,import,search,connectors}[/…] and
  // its /v1/knowledge alias — the KB knowledge graph + vault import + RAG retrieval. The
  // handler resolves the org from the Bearer owner (principal.Org) and 403s a cookie-only
  // call, so both heads route through /v1 exactly like framework/prompts.
  'kb',
  'knowledge',
  // ML serving (cloud clients/ml): /v1/ml/{models,health}[/:name[/predict]] — the org's
  // deployed KServe InferenceServices. The handler resolves the org from the Bearer owner
  // and lands every request in a PER-ORG namespace ("ml-"<org>); a cookie-only call 403s,
  // so it routes through /v1 exactly like agents/functions. One head admits the models
  // list/get + the create/predict sub-paths (the Inference product's endpoints source).
  'ml',
  // Code intelligence (cloud clients/code, order 134): /v1/code/{search,ask,context,
  // index}. Native per-org HYBRID retrieval (lexical + symbolic + semantic, RRF-fused)
  // over the org's indexed repos. The tenant boundary is a PHYSICAL per-org SQLite file
  // and the handler resolves the org from the Bearer owner (principal.Tenant) — a
  // cookie-only / forged-header call 403s, so it routes through /v1 exactly like
  // agents/prompts. The single `code` head admits every sub-path (search, ask, the
  // context bundle, and the index write).
  'code',
  // Business AI Guide (cloud clients/guide): /v1/guide + /v1/guide/{curriculum,steps/:id/
  // {start,done,skip,reset,do},actions}. The interactive launch checklist — a curriculum
  // drives the steps, per-org progress tracks a state per step, and the Business AI runs a
  // step for you (JSON or an SSE stream). The handler resolves the org from the Bearer owner
  // (principal.Tenant) and 403s a cookie-only call, so it routes through /v1 exactly like
  // crm/agents — the single `guide` head admits every sub-path (overview, curriculum GET/
  // PUT/DELETE, the per-step transitions + do, and the action ledger).
  'guide',
  // CRM (cloud clients/crm): /v1/crm/{summary,companies,contacts,opportunities}[/:id].
  // Native-Go per-org CRM on Base/SQLite (companies/contacts/opportunities). The
  // handler resolves the org from the Bearer owner (X-Org-Id) and 403s a cookie-only
  // call, so it routes through /v1 exactly like prompts/agents — the single `crm`
  // head admits every sub-path (summary, the three collections, their :id detail).
  'crm',
  // Company formation (cloud clients/company): /v1/company + /v1/company/{structure,
  // founders,kyc,payment,documents,esign,genesis,advance,skip,import/*,fundraise/*}.
  // The per-org incorporation state machine on Base/SQLite (structure → founders →
  // payment → documents → esign → genesis → company). The handler resolves the org
  // from the Bearer owner (principal.Org) and 403s a cookie-only call, so it routes
  // through /v1 exactly like crm — the single `company` head admits the formation
  // read + every stage-action + transition sub-path.
  'company',
  // Cap table (cloud clients/captable): /v1/captable/{company,stakeholders,classes,
  // plans,shares,options,safes,convertibles,rounds,investments,summary}[/:id].
  // The per-org capitalization ledger on Base/SQLite (HIP-0106); every route resolves
  // the org from the Bearer owner (principal.Org) and 403s a cookie-only call, so it
  // routes through /v1 exactly like crm — the single `captable` head admits every
  // sub-path (the computed summary, the collections, their :id detail + share transfer).
  'captable',
  // Marketing (cloud clients/marketing): /v1/marketing/{summary,campaigns[/:id]}.
  // Native-Go per-org campaign store on Base/SQLite (the in-process fold of
  // github.com/hanzoai/marketing, twin of crm). The handler resolves the org from
  // the Bearer owner (X-Org-Id) and 403s a cookie-only call, so it routes through
  // /v1 exactly like crm — the single `marketing` head admits every sub-path
  // (summary, the campaigns collection, its :id detail).
  'marketing',
  // Ads (cloud clients/ads): /v1/ads/{summary,campaigns[/:id]}. Native-Go per-org
  // ad-campaign store on Base/SQLite (net-new, twin of crm). The handler resolves the
  // org from the Bearer owner (X-Org-Id) and 403s a cookie-only call, so it routes
  // through /v1 exactly like crm — the single `ads` head admits every sub-path
  // (summary, the campaigns collection, its :id detail).
  'ads',
  // Social (cloud clients/social): /v1/social/{summary,accounts[/:id],posts[/:id]}.
  // Native-Go per-org accounts+posts store on Base/SQLite (the in-process fold of the
  // live social stack github.com/hanzoai/social, twin of crm). The handler resolves
  // the org from the Bearer owner (X-Org-Id) and 403s a cookie-only call, so it routes
  // through /v1 exactly like crm — the single `social` head admits every sub-path
  // (summary, the two collections, their :id detail).
  'social',
  // Referrals (cloud clients/referrals): /v1/referrals + /v1/referrals/claim. Native
  // per-org viral loop on Base/SQLite (referral code/link, claim, credit earned). The
  // handler resolves the org from the Bearer owner (X-Org-Id) and 403s a cookie-only
  // call, so it routes through /v1 exactly like crm — the single `referrals` head
  // admits the overview read + the claim POST (the /v1/admin/referrals* surface is a
  // separate global-admin head handled by app/admin/aggregate, not this proxy).
  'referrals',
  // Affiliates (cloud clients/affiliates): /v1/affiliates + /v1/affiliates/{apply,
  // attribute}. Native per-org partner-commission loop on Base/SQLite (apply, code/
  // link, attribution, accrued/pending/paid, payout history). The handler resolves the
  // org from the Bearer owner (X-Org-Id) and 403s a cookie-only call, so it routes
  // through /v1 exactly like referrals — the single `affiliates` head admits the
  // overview read + the apply/attribute POSTs (the /v1/admin/affiliates* surface is a
  // separate global-admin head handled by app/admin/aggregate, not this proxy).
  'affiliates',
  // Authors (cloud clients/authors): /v1/authors + /v1/authors/{connect,repos/verify}.
  // Native per-org OSS-author royalty loop on Base/SQLite (connect GitHub, verify owned
  // repos, share of deploying-org spend, accrued/pending/paid, payout history). The
  // handler resolves the org from the Bearer owner (X-Org-Id) and 403s a cookie-only
  // call, so it routes through /v1 exactly like affiliates — the single `authors`
  // head admits the overview read + the connect/verify POSTs (the /v1/admin/authors*
  // surface is a separate global-admin head handled by app/admin/aggregate, not this proxy).
  'authors',
  // Tracker (cloud clients/tracker): /v1/tracker/projects[/:key[/issues[/:num]]].
  // Native per-org issue tracker on Base/SQLite (projects + issues, rows grouped by
  // status). The handler resolves the org from the Bearer owner (X-Org-Id) and 403s a
  // cookie-only call, so it routes through /v1 exactly like crm/agents — the single
  // `tracker` head admits every sub-path (projects, a project's issues, their :num detail).
  'tracker',
  // Integrations (cloud clients/integrations): /v1/integrations[/:provider[/connect|
  // /disconnect]]. The generic, provider-agnostic OAuth connector framework (Slack =
  // reference impl, GitHub = registered seam). connect/list/disconnect resolve the org
  // from the Bearer owner (principal.Tenant) and 403 a cookie-only call, so they route
  // through /v1 exactly like crm/agents — the single `integrations` head admits the
  // list + per-provider detail + the connect/disconnect POST actions. (The provider
  // `callback` is Slack-initiated, state-authed, and hits cloud DIRECTLY at api.hanzo.ai
  // — never through this proxy — so it is out of scope here.)
  'integrations',
  // Unified analytics (cloud clients/analytics): /v1/analytics/{overview,timeseries,
  // realtime,top/*,llm/*}. Read-only per-org warehouse (Hanzo Datastore); the
  // handler resolves the org from the Bearer owner (X-Org-Id) and 403s a cookie-only
  // call, so it routes through /v1 like prompts/agents. Multi-segment sub-paths
  // (top/referrers, llm/overview) are admitted by the single `analytics` head.
  'analytics',
  // Unified usage summary (cloud clients/usage): /v1/usage/summary — the org's cost
  // roll-up (spend by category over time + wallet) + LLM usage totals, composed from
  // the commerce ledger + the warehouse. The handler resolves the org from the Bearer
  // owner (principal.Tenant) and 401s a cookie-only call, so it routes through /v1
  // exactly like analytics. One `usage` head admits the summary sub-path.
  'usage',
  // Org-scoped audit trail (cloud clients/auditlog): /v1/audit — the caller's OWN org
  // security events off the tamper-evident, hash-chained store (the per-org twin of the
  // global-admin /v1/admin/audit). Org is PINNED from the Bearer owner (principal.Tenant);
  // a cookie-only call 401s, so it routes through /v1 like the rest. Distinct from the
  // admin god-view, which stays on the global-admin aggregate proxy.
  'audit',
  // Evals facade (cloud clients/eval): /v1/evals/{scores,datasets[/:name/items],
  // rubrics,evaluators,runs}. Single-segment sub-paths under the one `evals` head; the
  // facade resolves the console project key pair from the request tenant (the
  // Bearer owner), so routing it through /v1 gives correct per-org scoping —
  // the same reason it must NOT be a cookie-only same-origin call (that 403s).
  'evals',
  // Research evidence plane (cloud clients/research, HIP-0512): /v1/research/
  // {experiments,totals,projects}. The R&D corpus every product self-logs — falsifiable
  // experiments (kernel-perf/benchmark/training/ablation/policy-eval) with proofs +
  // refutations. The handler resolves the org from the Bearer owner (principal.Org) and
  // 403s a cookie-only call, so it routes through /v1 exactly like evals — one `research`
  // head admits every sub-path (the ledger list, the headline totals, the projects roll-up).
  'research',
  // Read-only starter-kit gallery (cloud clients/templates): /v1/templates[/:slug].
  // Public reference content (no org scoping) but routed through /v1 like the
  // rest of the surface so dev + prod share ONE path.
  'templates',
  // Buildable/deployable projects store (cloud clients/projectsvc): /v1/projects[/*],
  // incl. POST /v1/projects/fork (fork a gallery template into a real project). The
  // handler resolves the org from the Bearer owner (X-Org-Id) and 403s a cookie-only
  // call, so it routes through /v1 like the rest of the surface.
  'projects',
  // The platform control plane (cloud clients/platform): /v1/platform/{projects,
  // projects/:p/apps,.../deploy,.../deployments,.../deployments/:id/logs,fleet,health}.
  // Per-org container-app platform on Base/SQLite; SanitizeIdentity resolves the org
  // from the Bearer owner and 403s a cookie-only call, so it routes through /v1 like
  // the rest — the single `platform` head admits every sub-path, including the
  // operator fleet board at /v1/platform/fleet (folded in from the retired /v1/paas:
  // paas was a second name for platform, and one product gets one name).
  'platform',
  // SBOM datastore (cloud clients/sbom): /v1/sbom/{ref} — the software bill of
  // materials CI recorded for an image ref/digest (components + licenses). The
  // handler resolves the org from the Bearer owner and 403s a cookie-only call, so
  // it routes through /v1 like platform — the single `sbom` head admits the by-ref
  // lookup (the deployments view's read-only SBOM panel).
  'sbom',
  // Finance ledger (hanzoai/finance, embedded in cloud): /v1/finance/{balance,credits,
  // usage,invoices,payment-methods,ledger,treasury}. Per-org double-entry ledger on
  // Base; the handler resolves the org from the Bearer owner and 403s a cookie-only
  // call, so it routes through /v1 like platform/analytics. Read-only; writes stay
  // in the billing portal. The single `finance` head admits every finance sub-path.
  'finance',
  // ── Native cloud infra surfaces (the unified cloud binary now serves these
  // per-org at /v1/*, previously the admin `/paas` control plane). Each resolves the
  // org from the Bearer owner (X-Org-Id) and 403s a cookie-only call, so it routes
  // through /v1 exactly like the rest; one head admits every sub-path.
  //
  // Compute (visor-backed): machines inventory + launch/quote/terminate
  // (/v1/machines[/launch|/:id]); GPU inventory + alerts + pools (/v1/gpus[/alerts|
  // /pools]); the BYO connect fleet with live heartbeat (/v1/fleet/workers); dedicated
  // clusters + node-pool add/scale/delete (/v1/clusters[/:cid/pools[/:pid[/scale]]]).
  'machines',
  'gpus',
  'fleet',
  'clusters',
  // Sandboxes (cloud apps/sandbox): the org's leased gVisor pods — lease/list/get/
  // end, exec, fs, and the ticket that opens an interactive terminal
  // (/v1/sandboxes[/:id[/exec|/fs|/terminal]]). Same gate as the rest: the handler
  // resolves the org from the Bearer owner and answers 403 without one, and an id
  // belonging to another org is a 404.
  //
  // The terminal's SOCKET does not come through here and cannot: a Next route
  // handler proxies requests, not upgrades. The browser dials the API host
  // directly, carrying the single-use ticket this proxy fetched for it — which is
  // the whole reason the ticket exists.
  'sandboxes',
  // DO-native: virtual private clouds and managed load balancers — FULL CRUD
  // (/v1/vpcs[/:id], /v1/balancers[/:id]).
  'vpcs',
  'balancers',
  // (`dns` — the managed-DNS head — is declared ONCE above, with the data resources.)
  // Platform aggregates (read-only, derived): deploy targets, CI pipelines, image/
  // binary builds, and versioned releases (/v1/{environments,pipelines,builds,releases}).
  'environments',
  'pipelines',
  'builds',
  'releases',
  // Networking (zt-backed, Hanzo Zero Trust / OpenZiti fabric): the org's overlay
  // networks (/v1/networks[/:id]), mesh services (/v1/mesh/services), and edge nodes
  // (/v1/edge/nodes). One head per console page — Networks / ServiceMesh / Edge.
  'networks',
  'mesh',
  'edge',
  // Fine-grained authorization (hanzoai/authz, order 70): the org's access-control
  // policy set (/v1/authz/policies) plus check/health. The subsystem picks the
  // per-org enforcer from the Bearer-derived X-Org-Id — a cookie-only call has none —
  // so it routes through /v1 like the rest (GET policies needs only the org; the
  // POST/DELETE writes additionally require an admin role). One head admits the
  // policies list + the check sub-path. Backs the console's Authz page.
  'authz',
  // Observability (hanzoai/o11y): the cloud binary serves the embedded o11y surface at
  // the FLAT, VERSION-LESS canonical `/v1/o11y/<resource>` — one /v1/, no nested /api/vN.
  // The console reads e.g. /v1/o11y/rules (alerts), /v1/o11y/services (RED metrics),
  // /v1/o11y/query_range (the composite logs/traces list), /v1/o11y/vm/{query,query_range}
  // (the SuperAdmin VM proxy), /v1/o11y/health. The upstream SigNoz engine version is
  // resolved SERVER-SIDE inside cloud (clients/o11y) — never leaked into a route. cloud's
  // principal gate refuses any bearer-less call, so it routes through the /v1 bearer BFF
  // like the rest. The single `o11y` head admits every o11y sub-path.
  'o11y',
  // Hanzo Sentry (cloud clients/sentry): the full error/log/trace product surface at
  // the canonical `/v1/sentry/<resource>` — projects (+ DSN/key rotate), issues (list/
  // get/update/events), discover, events, logs, traces (+ detail), stats. The Sentry
  // face (sentry.<brand>) reads it over the same-origin `/v1` bearer BFF; the handler
  // scopes every read to the SANITIZED caller org (X-Org-Id from the Bearer owner) and
  // 403s a cookie-only / cross-tenant call, so it routes through /v1 exactly like o11y.
  // The single `sentry` head admits every sentry sub-path.
  'sentry',
  // Web Search (cloud clients/websearch, order 141): /v1/websearch/{search,scrape}.
  // Self-hosted SearXNG meta-search + Crawl4AI scrape. The `search` proxy has no
  // principal gate (its optional X-API-Key admits a missing key), so a signed-in
  // user's minted bearer is accepted/ignored and the query proxies straight to
  // SearXNG — routing it through /v1 gives the console a keyless, prefix-free
  // `/v1/websearch/search`. (Scrape 503s without the shared crawl key — not a user
  // token — so the console never drives a live scrape; it documents it only.) One
  // head admits both the search + the scrape sub-path (the /v1-first law: a flat
  // `/v1/websearch/scrape`, no nested inner version).
  'websearch',
  // Chain data (graph-backed, luxfi/indexer + luxfi/graph): the deployment's chain
  // indexing status (/v1/indexers — chain/network/height/health) and on-chain
  // price/data oracle feeds (/v1/oracles — O-Chain PriceFeed registry). The cloud
  // `graph` subsystem principal-gates every read (a cookie-only call 403s) and scopes
  // per brand (each brand's cloud is wired to its own indexer/graph), so it routes
  // through /v1 like the rest. One head per console page — Indexer / Oracles.
  'indexers',
  'oracles',
  // Enablement registry USER surface (cloud clients/pricing): /v1/enablement[/optin|optout].
  // Any authenticated user's effective feature/model view + self-service beta opt-in;
  // the handler scopes to the SANITIZED caller org (X-Org-Id from the Bearer owner) and
  // refuses a non-beta item, so it routes through /v1 like the rest (a cookie-only
  // call 403s). Distinct from the global-admin /v1/admin/enablement (the aggregate proxy).
  'enablement',
  // Casibase store-admin surface (cloud binary, casibase `*-store(s)` routes): the org's
  // knowledge STORES that back Embeddings · Collections and store settings. Each is a
  // Bearer-required, org-scoped (owner from the token) casibase-envelope call, so a
  // cookie-only `/v1/get-stores` 401s → a FALSE "session expired" for a signed-in user.
  // Routing through /v1 mints the user token like the rest. LEAST PRIVILEGE: only the
  // heads the console actually calls — read (list/get), mutate (add/update/delete/refresh).
  // Deliberately NOT `get-global-stores` (a cross-tenant read the console never invokes)
  // nor `get-store-names` (unused) — do not widen the tunnel past what's used.
  // Knowledge-store ingest + per-file index status (casibase docs surface): the
  // Embeddings product's ingest actions (`/v1/docs/ingest` — upload/github/crawl) and
  // per-file status (`/v1/get-files`). Bearer-required + org-scoped (owner from the
  // token); a cookie-only call 401s, so they route through /v1 like the stores.
  'docs',
  // The ai service (hanzoai/ai): /v1/ai/{stores,files,vectors,chats,messages,
  // providers,routes,tasks,records,usages,account,…}. ONE SERVICE head, which is
  // what a head-based allow-list is supposed to mean — this used to enumerate
  // eight individual ROUTES (get-stores, add-store, …) because the surface had no
  // namespace to enumerate.
  'ai',
  // Embeddings/collections usage slice of the cloud-usage read API (`/v1/get-cloud-usages`).
  // Bearer-required; degrades to "—" but should read real data through /v1.
  // Per-org product entitlements (cloud clients/entitlements): /v1/orgs/{org}/entitlements
  // — the set of products the org has enabled (out-of-box each org assembles its own
  // backend from the catalog). GET reads the enabled ids; POST { add?, remove? } toggles
  // them. The handler resolves + PINS the org from the Bearer owner (a customer can only
  // read/mutate their OWN org's entitlements; a super admin any org, server-enforced),
  // so it routes through /v1 exactly like the rest — a cookie-only call 403s. The single
  // `orgs` head admits the org-scoped entitlements sub-path (the console never calls any
  // other `orgs/*` surface; keep the tunnel to exactly what's used).
  'orgs',
  // CD / deploy plane (cloud clients/deploy reads the operator hanzo.ai/v1 App CRs):
  // /v1/deploy/{applications, health, :name/tree, :name/resource/:ref, :name/logs} +
  // POST :name/{rollback,sync}. cloud holds the k8s client + enforces authz
  // server-side (today SuperAdmin-only; the org-scoped projection keys it by the
  // Bearer owner). The single `deploy` head admits every sub-path; the console never
  // touches the cluster — a cookie-only/forbidden call 403s like the rest.
  'deploy',
  // Hanzo Git (cloud clients/git): /v1/git/repos[/:name[/{refs,tree,blob,commits,readme}]].
  // The org's hosted code repositories — the native-Go git host welded into the cloud
  // binary (smart-HTTP + the /v1/git control plane + the JSON browse surface). The
  // handler resolves the org from the Bearer owner (X-Org-Id) and 403s a cookie-only
  // call, so it routes through /v1 exactly like the rest — the single `git` head admits
  // the repos list/detail + the read/browse sub-paths (refs, tree, blob, commits, readme).
  // The `/v1/git/:org/:repo/*` smart-HTTP protocol routes are NOT reached here (the git
  // CLI hits git.hanzo.ai directly); this is the console's repo-browser read surface.
  'git',
  // Base data plane (cloud clients/base collections.go): /v1/collections[/<name>[/records
  // [/<id>]]] + /v1/collections/meta/scaffolds. cloud reverse-proxies these to the managed
  // Base (base.hanzo.ai), principal-gated, forwarding the caller's Bearer (which the Base
  // validates against IAM JWKS and scopes per-user/per-collection). The console's Base
  // product (Bases manager `tenants` registry + Records) reaches it here; a cookie-only /
  // forged call is refused, so it routes through /v1 exactly like the rest. cloud's own
  // allow-list keeps it a collections proxy, never a general Base tunnel.
  'collections',
  // Telemetry ingest (cloud clients/analytics event.go): POST /v1/event — the ONE
  // canonical front door for the @hanzo/event client (pageviews · product events ·
  // identify · errors) as one batched stream, lensed server-side into web analytics,
  // product insights, and error tracking. cloud stamps the tenant from the validated
  // session/bearer (the client NEVER sends an org), so on the standalone BFF the minted
  // user bearer forwards it as the signed-in user. The primary go:embed console hits
  // cloud's /v1/event natively (the BFF is pruned there).
  'event',
  // User preferences (cloud apps/prefs): GET + PATCH /v1/prefs — the caller's OWN
  // document (theme, pinned nav) following them across every Hanzo surface. The
  // subject is the `<owner>/<name>` identity built from the validated Bearer and is
  // the mandatory predicate on both verbs, so it routes through /v1 exactly like
  // agents/prompts. There is no path to another user's document, which is why the
  // head admits no sub-path beyond the one it serves.
  'prefs',
  // Conversion destinations (cloud clients/destinations): /v1/destinations[/:platform
  // [/test]]. The org's server-side Conversions API sinks — the same events the browser
  // pixel sends, forwarded server-to-server with a shared event_id so a platform can
  // dedupe the pair. The handler resolves the org from the Bearer owner and requires the
  // org-admin bit to MUTATE, so it routes through /v1 exactly like webhooks/automations.
  // The single `destinations` head admits the list, one platform's connect/disconnect,
  // and its test send. A destination's API credential is sealed into KMS server-side and
  // is never in a response — the head carries connection STATE, never a secret.
  'destinations',
  // Browser tag door (cloud apps/projects tagdoor.go): GET /v1/tags?key=<pk->. The
  // resolved client-side pixel set for one site — which tags the hosted tag will inject,
  // with their non-secret ids. PUBLIC and fail-safe by design (CORS *, an unresolvable
  // key is an empty set at 200), because a customer's page fetches it directly; it is
  // allow-listed only so the console can PREVIEW what a site will inject through the
  // same one same-origin form as every other read. Read-only — the ids are SET by
  // PATCH /v1/projects/:slug, on the `projects` head.
  'tags',
]

/** The `<head>` of a `v1/<head>/...` path, or null when it isn't a `v1/` path. */
export function v1Head(path: string): string | null {
  const m = path.replace(/^\/+/, '').match(/^v1\/([^/?#]+)/)
  return m ? m[1] : null
}

/** True iff `path` (e.g. `v1/vector/mydb`) is an allow-listed cloud-api surface. */
/**
 * Sub-paths refused even though their head is admitted.
 *
 * A head grants a whole subsystem, which is the right grain for a tenant-scoped
 * family — but the cross-tenant store listing is an admin read the console never
 * invokes, and it was explicitly refused before the surface was namespaced.
 * Granting `ai` would have admitted it silently, so the refusal follows the path.
 *
 * Deliberately scoped to that ONE path, not a blanket rule over every `global`
 * sub-path: the Providers board does read its cross-tenant catalog, and a blanket
 * rule would break a live surface while claiming to preserve a property that never
 * covered it. Defense in depth — the backend gates cross-tenant reads on its own.
 */
const REFUSED_SUBPATHS: readonly RegExp[] = [
  /^v1\/ai\/stores\/global(?:$|[/?#])/,
  // The tool plane's DISPATCH door. `tools` is allow-listed for discovery — the agent
  // builder needs to offer the org's real tool names — but a head admits every
  // sub-path, and `POST /v1/tools/call` RUNS a tool. Executing one belongs to whatever
  // runs an agent, never to a form in a browser tab, so the console's proxy is a
  // read-only window onto the plane.
  /^v1\/tools\/call(?:$|[/?#])/,
]

export function allowCloudSurface(path: string): boolean {
  const rel = path.replace(/^\/+/, '')
  if (REFUSED_SUBPATHS.some((re) => re.test(rel))) {
    return false
  }
  const head = v1Head(path)
  return head != null && CLOUD_HEADS.includes(head)
}

/**
 * True iff `path` targets the visor `/v1/*` surface (regions/gpus/machines/…). Visor
 * (vm.hanzo.ai) serves ONLY its own compute surface, so the whole `v1/` subtree is
 * the correct boundary — the task's `/v1/vm` → visor `/v1/*` contract — while still
 * refusing any non-`v1` path.
 */
export function allowVisorSurface(path: string): boolean {
  const rel = path.replace(/^\/+/, '')
  return rel === 'v1' || rel.startsWith('v1/')
}

/**
 * Commerce `/v1/<head>` store surfaces reachable through `/commerce` as the signed-in
 * user. Commerce (`commerce.hanzo.svc`) serves the whole store admin over its REST
 * models, and EdgeAuth scopes every one to the Bearer owner's org — but this list is
 * defense in depth: it keeps the `/commerce` proxy from being a general tunnel to the
 * money/tenant-admin surfaces that share the same binary (`billing`, `checkout`,
 * `_/commerce/tenants`, `namespace`), which the console reaches through their OWN
 * scoped proxies (`/billing`) or not at all. Only the merchant catalog/order/customer
 * heads the store dashboard reads + writes are admitted (singular REST model names,
 * matching commerce's `rest.New(<kind>{})` routes).
 */
export const COMMERCE_HEADS: readonly string[] = [
  'product', // products
  'variant', // inventory / SKUs
  'collection', // catalog collections
  'order', // orders
  'user', // customers
  'discount', // promotions & discounts
  'coupon', // discount codes
  'saleschannel', // sales channels
  'stocklocation', // stock locations
  'store', // storefront settings
]

/** True iff `path` (e.g. `v1/product/abc`) is an allow-listed commerce store surface. */
export function allowCommerceSurface(path: string): boolean {
  const head = v1Head(path)
  return head != null && COMMERCE_HEADS.includes(head)
}

/**
 * Commerce PLATFORM-CATALOG admin surface reachable through `/v1/catalog` as the
 * signed-in SuperAdmin. Commerce serves the catalog CMS under `/v1/catalog/*` on
 * its `/v1` bundle: `entries` (GET list incl. cost/margin, POST create),
 * `entries/:slug` (PUT update, DELETE remove), and `seed` (POST upsert). This list
 * is the least-privilege boundary — it admits ONLY those catalog paths, so the
 * `/v1/catalog` proxy can never tunnel commerce's money/tenant surfaces
 * (`billing`, `checkout`, `_/commerce/tenants`, the merchant store models) that
 * share the binary. Commerce's own `requireSuperAdmin` (owner=="admin") is the
 * authoritative auth gate on top of this; this only bounds the reachable PATHS.
 */
export function allowCatalogSurface(path: string): boolean {
  const rel = path.replace(/^\/+/, '').replace(/\/+$/, '')
  if (rel === 'v1/catalog/entries') return true // list (GET) + create (POST)
  if (/^v1\/catalog\/entries\/[^/]+$/.test(rel)) return true // update (PUT) + delete (DELETE) by slug
  if (rel === 'v1/catalog/seed') return true // upsert the embedded seed (POST)
  return false
}

/**
 * Commerce PLATFORM-PLAN admin surface reachable through `/v1/plans` as the signed-in
 * SuperAdmin. Commerce serves the subscription/DNS plan authority CMS under
 * `/v1/plans/*` on its `/v1` bundle: `entries` (GET list, POST create), `entries/:slug`
 * (PUT update, DELETE remove), and `seed` (POST upsert). The sibling of
 * `allowCatalogSurface` — the same least-privilege boundary, admitting ONLY those plan
 * paths, so the `/v1/plans` proxy can never tunnel commerce's money/tenant surfaces
 * (`billing`, `checkout`, `_/commerce/tenants`, the merchant store models). Commerce's
 * own `requireSuperAdmin` (owner=="admin") is the authoritative auth gate on top of
 * this — money-adjacent, since a plan's price is the real renewal charge; this only
 * bounds the reachable PATHS.
 */
export function allowPlansSurface(path: string): boolean {
  const rel = path.replace(/^\/+/, '').replace(/\/+$/, '')
  if (rel === 'v1/plans/entries') return true // list (GET) + create (POST)
  if (/^v1\/plans\/entries\/[^/]+$/.test(rel)) return true // update (PUT) + delete (DELETE) by slug
  if (rel === 'v1/plans/seed') return true // upsert the embedded seed (POST)
  return false
}

/**
 * Payload CMS (`cms.<brand>`) READ surfaces reachable through `/cms` as the signed-in
 * user. The console forwards the caller's own IAM Bearer; Payload's `hanzoIAMStrategy`
 * verifies it (JWKS, issuer hanzo.id) and its multi-tenant plugin scopes `pages`/`media`
 * to the token's `owner` claim — so a merchant only ever reads their OWN org's content
 * (isolation is BACKEND-enforced, per-tenant). This list is the defense-in-depth
 * boundary: it admits ONLY the two tenant-scoped collections (list) + the per-file media
 * bytes route, and DELIBERATELY refuses `api/users` and `api/tenants` — the two Payload
 * collections that are auth-gated but NOT tenant-row-scoped (listing them would leak the
 * cross-org user/tenant registry). Read-only by construction; the module never mutates.
 */
const CMS_MEDIA_FILE = /^api\/media\/file\/[^/]+$/
export function allowCmsSurface(path: string): boolean {
  const rel = path.replace(/^\/+/, '')
  if (rel === 'api/pages') return true // Collections list (tenant-scoped)
  if (rel === 'api/media') return true // Media/DAM list (tenant-scoped)
  if (CMS_MEDIA_FILE.test(rel)) return true // media bytes (tenant-scoped by Payload)
  return false
}

/**
 * Frappe/ERPNext (`erp.<brand>`) READ surface reachable through `/erp`. ERP is a SINGLE
 * shared per-brand Frappe instance (NOT per-org row-scoped), so the `/erp` route also
 * entitlement-gates to the owning brand org / a global admin — this list is the path
 * least-privilege boundary on top of that.
 *
 * Pinned to EXACTLY the three DocTypes the native summary views read (Accounting/Items/
 * Sales), NOT "any DocType" (RED LOW-1): an entitled brand member must not be able to
 * `GET /api/resource/User` / `Salary Slip` / `OAuth Bearer Token` through the shared
 * `ERP_API_TOKEN` — a brand-internal over-read the moment ERP ships with a broad token.
 * Read-only: only `GET /api/resource/<one of these>` (list); never a single-doc read,
 * `/api/method/*`, the desk, or login. A DocType with a space ("Sales Order") arrives as
 * one decoded segment; `bearer-proxy`'s `pathIsClean` still rejects encoded traversal.
 */
export const ERP_DOCTYPES: ReadonlySet<string> = new Set(['Account', 'Item', 'Sales Order'])
export function allowErpSurface(path: string): boolean {
  const m = path.replace(/^\/+/, '').match(/^api\/resource\/(.+)$/)
  return m != null && ERP_DOCTYPES.has(m[1])
}

/** Matches exactly `v1/collections/<name>/records` and `.../records/<id>` (one clean
 *  segment each — `bearer-proxy` has already rejected empty/dot/encoded segments). */
const BASE_RECORDS = /^v1\/collections\/[^/]+\/records(?:\/[^/]+)?$/

/** Matches a single content-type (collection) admin path `v1/collections/<name>` —
 *  view / update / delete ONE collection. The content-type builder needs this. */
const BASE_COLLECTION = /^v1\/collections\/[^/]+$/

/**
 * True iff `path` targets the Hanzo Base COLLECTION surface reachable through
 * `/superbase` as the signed-in user:
 *  - `v1/collections` — list the schemas (read) AND create a content type (POST);
 *  - `v1/collections/meta/scaffolds` — the base/auth/view field-template palette;
 *  - `v1/collections/<name>` — view / update / delete ONE content type (the builder);
 *  - `v1/collections/<name>/records[/<id>]` — that collection's records CRUD.
 *
 * Base authorizes every one of these itself: records by each collection's
 * ListRule/ViewRule/CreateRule/…, and ALL collection mutation behind its own
 * superuser gate (an org admin's minted token qualifies; a plain member gets an
 * honest 403), scoped per-org by the `X-Org-Id` the proxy stamps from the JWT
 * owner. This allow-list is the defense-in-depth boundary that keeps `/superbase`
 * from tunneling Base's NON-collection admin (settings / backups / logs) — it
 * stays a collections proxy, never a general Base tunnel.
 */
export function allowBaseSurface(path: string): boolean {
  const rel = path.replace(/^\/+/, '')
  if (rel === 'v1/collections') return true
  if (rel === 'v1/collections/meta/scaffolds') return true
  if (BASE_RECORDS.test(rel)) return true
  if (BASE_COLLECTION.test(rel)) return true
  return false
}
