/**
 * Platform API — Hanzo cluster inventory + PaaS control plane.
 *
 * TWO transports, cleanly split by authority:
 *   - Cluster INVENTORY + node-pool lifecycle (list / get / add-pool / scale-pool /
 *     delete-pool) go through the unified cloud binary at `/v1/clusters*`, via the
 *     same-origin user-bearer `/v1` proxy (app/v1/[...path]/route.ts → cloud-api,
 *     org resolved from the Bearer owner). This is the native, per-org surface every
 *     cluster consumer reads — one source of truth.
 *   - The apps inventory and cluster PROVISIONING (spin up a whole new DOKS cluster)
 *     stay on the `/paas` control plane (app/paas/[...path]/route.ts), which injects the
 *     platform SERVICE token from server-only env (KMS) and is brand-admin gated — the
 *     right authority for a god-mode, multi-tenant operation. When the token is unset the
 *     proxy returns an honest 501 the UI renders as "not configured"; nothing is fabricated.
 *
 * REAL surfaces:
 *   - GET /v1/apps                 → the apps inventory (Status + Kubernetes modules).
 *   - GET /v1/clusters[/:id]       → the org's DEDICATED Hanzo K8S (DOKS) clusters, with
 *     their node pools. Honest empty when the org has none (shared Hanzo Cloud is default).
 *   - POST   /v1/clusters/:cid/pools            → add a node pool.
 *   - POST   /v1/clusters/:cid/pools/:pid/scale → scale a pool's node count.
 *   - DELETE /v1/clusters/:cid/pools/:pid       → remove a node pool.
 *   - POST /v1/org/{org}/cluster   → provision a fresh dedicated cluster (`/paas`).
 */
import { restGet, restPost, restDelete, cloudProxyV1Url } from './client'
import { IS_EMBED } from '~/lib/embed'

/** Where a cluster lives: shared multi-tenant Hanzo Cloud, or a BYO/managed DOKS. */
export type ClusterKind = 'shared' | 'byo' | (string & {})

/**
 * One node pool of a cluster (`doks_node_pool`). A pool is a set of `count`
 * identical droplets of `size` (a DigitalOcean size slug, e.g. `s-4vcpu-8gb`).
 * The cluster's individual MACHINES (nodes) are the union of its pools' nodes —
 * the control plane exposes pools (size + count), not per-droplet objects.
 */
export type NodePool = {
  poolId?: string
  doPoolId?: string | null
  name?: string
  /** DigitalOcean size slug (e.g. `s-4vcpu-8gb`, `c-2`). */
  size?: string
  /** Number of nodes (droplets) in this pool. */
  count?: number
  minNodes?: number
  maxNodes?: number
  autoScale?: boolean
  tags?: string[]
}

/**
 * A dedicated Kubernetes cluster as the platform lists it
 * (`GET /v1/org/{org}/cluster` → `DoksClusterWithPools`, kubeconfig redacted).
 * The REAL fields below come straight from the `doks_cluster` row + its
 * `nodePools`; the trailing legacy fields are kept optional only so the simple
 * Clusters list keeps compiling — the authoritative node inventory is `nodePools`.
 */
export type Cluster = {
  /** Platform's cluster id (primary key). */
  doksClusterId?: string
  /** DigitalOcean's own cluster id (null until provisioned). */
  doClusterId?: string | null
  name: string
  region?: string
  /** DigitalOcean state: pending|provisioning|running|error|deleting|deleted. */
  status: string
  /** Platform lifecycle phase (requested→provisioning→installing→ready/error). */
  phase?: string
  endpoint?: string | null
  k8sVersion?: string | null
  ha?: boolean
  /** This cluster is the org's selected deploy target (≤1 active per org). */
  active?: boolean
  operatorInstalled?: boolean
  baselineInstalled?: boolean
  baselineError?: string | null
  createdAt?: string
  tags?: string[]
  /** The real per-pool node inventory (size + count). */
  nodePools?: NodePool[]
  // ── Legacy/derived display fields (optional; real node info is `nodePools`) ──
  id?: string
  kind?: ClusterKind
  nodeSize?: string
  nodeCount?: number
  version?: string
  // ── Fleet fields (additive) — a BYO ("bring your own") attached cluster reports
  //    the live accelerator inventory it was validated with (nvidia.com/gpu +
  //    amd.com/gpu allocatable, summed across its nodes). A managed cluster omits
  //    these (its node pools carry the compute), so they render an honest "—".
  nvidiaGpu?: number
  amdGpu?: number
}

/** Provision a fresh dedicated DOKS cluster (the DO token is read from KMS server-side). */
export type ProvisionClusterInput = {
  region: string
  nodeSize: string
  nodeCount: number
  ha?: boolean
}

/**
 * Attach a BYO ("bring your own") Kubernetes cluster to the org's fleet
 * (`POST /v1/clusters`). The kubeconfig is validated by REACHING the cluster (its
 * node + GPU inventory), sealed in the org's KMS server-side, and never stored or
 * returned by the console. `provider` is a free label (byo | k3s | …); `default`
 * makes it the org's default workload target. Returns the attached cluster
 * (`kind:"byo"`, `status:"attached"`, with the live GPU inventory it reported).
 */
export type AttachClusterInput = {
  name: string
  kubeconfig: string
  provider?: string
  default?: boolean
}

/** Add a node pool to an existing cluster (`POST /v1/clusters/:cid/pools`). */
export type AddPoolInput = {
  /** DigitalOcean size slug (e.g. `s-4vcpu-8gb`, `gpu-h100x1-80gb`). */
  size: string
  /** Number of nodes in the new pool. */
  count: number
  name?: string
  minNodes?: number
  maxNodes?: number
  autoScale?: boolean
}

/** Health of an app/workload as the inventory reports it. */
export type AppHealth = 'green' | 'yellow' | 'red' | (string & {})

/** One drift flag on an app (declared/running/release mismatch). */
export type AppDriftFlag = { kind: string; severity: string; message: string }

/**
 * One row of the apps inventory (`GET /v1/apps`) — an operator-managed service
 * (a `Service` CR + its Deployment) observed on a cluster. Fields the platform
 * may omit are optional; the UI renders what is present and never invents the rest.
 */
export type PlatformApp = {
  id: string
  org: string
  app: string
  env: string
  repo?: string
  registry?: string
  declaredTag?: string | null
  runningTag?: string | null
  latestTag?: string | null
  releaseUrl?: string | null
  health: AppHealth
  cluster: string
  namespace?: string
  lastObserved?: string
  updatedAt?: string
  drift?: { severity?: string; flags?: AppDriftFlag[] }
}

/** Optional filters for the apps inventory (mirrors the platform's query params). */
export type AppsQuery = {
  org?: string
  env?: 'dev' | 'test' | 'main'
  health?: 'green' | 'yellow' | 'red'
  /** Only rows the reconciler considers drifting. */
  drift?: boolean
}

/**
 * Same-origin PaaS inventory path, split by DEPLOYMENT topology:
 *  - STANDALONE console (console2/admin.hanzo.ai): the `/paas/*` server proxy, which
 *    injects the platform SERVICE token (KMS) and is brand-admin gated.
 *  - go:embed console (IS_EMBED, console.hanzo.ai / cloud.hanzo.ai): the static export
 *    has NO server routes — `/paas/*` is pruned and cloud's catch-all serves the SPA
 *    index (HTTP 200 HTML) for any non-`/v1/` path, so the old `/paas` client parsed the
 *    SPA and errored "Invalid response from server (HTTP 200)" → "Could not reach the
 *    platform" (the broken Observe→Status). Cloud serves the SAME fleet inventory
 *    natively at `/v1/paas/<path>` (bearer-scoped from the validated principal), so in
 *    the embed we address it directly. The `/v1` BFF deliberately EXCLUDES `paas/*`
 *    (proxy-allow.ts), which is why this is embed-gated rather than unconditional.
 */
const url = (path: string) =>
  IS_EMBED
    ? cloudProxyV1Url(`paas/${path.replace(/^\/+/, '')}`)
    : `/paas/${path.replace(/^\/+/, '')}`
const enc = encodeURIComponent

const qs = (q: AppsQuery): string => {
  const p = new URLSearchParams()
  if (q.org) p.set('org', q.org)
  if (q.env) p.set('env', q.env)
  if (q.health) p.set('health', q.health)
  if (q.drift) p.set('drift', 'true')
  const s = p.toString()
  return s ? `?${s}` : ''
}

/** Pull a `Cluster[]` from `{clusters:[…]}`, `{data:[…]}`, or a bare array (defensive). */
const clustersOf = (payload: unknown): Cluster[] => {
  if (Array.isArray(payload)) return payload as Cluster[]
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>
    if (Array.isArray(o.clusters)) return o.clusters as Cluster[]
    if (Array.isArray(o.data)) return o.data as Cluster[]
  }
  return []
}

/** Canonical path for the clusters surface (`/v1/clusters…`); `next.config` rewrites
 *  it to the same-origin user-bearer `/v1` proxy. */
const clustersUrl = (path = ''): string => cloudProxyV1Url(`clusters${path}`)

export const PlatformApi = {
  /** The apps inventory — the real "what is running" board across all clusters (`/paas`). */
  apps: async (query: AppsQuery = {}): Promise<PlatformApp[]> => {
    const r = await restGet<{ apps?: PlatformApp[] }>(url(`apps${qs(query)}`))
    return r?.apps ?? []
  },

  /**
   * The signed-in org's dedicated DOKS clusters (`GET /v1/clusters`, org-scoped by the
   * Bearer owner; honest empty when none provisioned). Each cluster carries its
   * `nodePools` (size + count) — the real source of the org's compute MACHINES (the
   * Machines page projects nodes from these pools).
   */
  listClusters: async (): Promise<Cluster[]> => clustersOf(await restGet<unknown>(clustersUrl())),

  /** One cluster by id (with node pools; kubeconfig redacted). Null when absent. */
  getCluster: async (clusterId: string): Promise<Cluster | null> => {
    const r = await restGet<{ cluster?: Cluster } | Cluster>(clustersUrl(`/${enc(clusterId)}`))
    if (r && typeof r === 'object' && 'cluster' in r) return (r as { cluster?: Cluster }).cluster ?? null
    return (r as Cluster) ?? null
  },

  /**
   * Attach a BYO cluster by kubeconfig (`POST /v1/clusters`). The backend validates
   * it by reaching the cluster (node + GPU inventory), seals the kubeconfig in the
   * org's KMS, and returns the attached cluster (`kind:"byo"`, `status:"attached"`).
   * Honest failures propagate as `ApiError`: 503 (BYO attach not configured — KMS
   * required on this deployment), 422 (kubeconfig unusable / cluster unreachable),
   * 402 (nominal management-fee billing gate), 400 (missing name/kubeconfig).
   */
  attachCluster: async (input: AttachClusterInput): Promise<Cluster> =>
    (await restPost<Cluster>(clustersUrl(), input)) ?? ({} as Cluster),

  /** Detach a BYO cluster from the org's fleet (`DELETE /v1/clusters/:id`, id = its
   *  name). Only touches BYO clusters; managed pools use the node-pool routes. */
  detachCluster: (id: string): Promise<void> => restDelete(clustersUrl(`/${enc(id)}`)),

  /** Add a node pool to a cluster (`POST /v1/clusters/:cid/pools`). */
  addPool: (clusterId: string, input: AddPoolInput): Promise<void> =>
    restPost<unknown>(clustersUrl(`/${enc(clusterId)}/pools`), input).then(() => undefined),

  /** Scale a node pool's count (`POST /v1/clusters/:cid/pools/:pid/scale`). */
  scalePool: (clusterId: string, poolId: string, count: number): Promise<void> =>
    restPost<unknown>(clustersUrl(`/${enc(clusterId)}/pools/${enc(poolId)}/scale`), { count }).then(() => undefined),

  /** Remove a node pool (`DELETE /v1/clusters/:cid/pools/:pid`). */
  deletePool: (clusterId: string, poolId: string): Promise<void> =>
    restDelete(clustersUrl(`/${enc(clusterId)}/pools/${enc(poolId)}`)),

  /**
   * Provision a fresh dedicated DOKS cluster for the org
   * (`POST /v1/org/{org}/cluster`). Served by Hanzo Cloud's EMBEDDED platform via
   * the same-origin user-bearer `/v1` proxy — org-scoped by the Bearer owner,
   * the DigitalOcean credential lives server-side IN cloud, NOT a console `/paas`
   * service token. (Same native-`/v1` path as `listClusters`.)
   */
  provisionCluster: async (org: string, input: ProvisionClusterInput): Promise<Cluster> => {
    const r = await restPost<{ cluster: Cluster }>(cloudProxyV1Url(`org/${enc(org)}/cluster`), input)
    return r.cluster
  },
}

/** DOKS regions offered for provisioning (DigitalOcean Kubernetes). */
export const DOKS_REGIONS = [
  'nyc1',
  'nyc3',
  'sfo3',
  'ams3',
  'fra1',
  'lon1',
  'tor1',
  'blr1',
  'sgp1',
  'syd1',
] as const

/** DOKS node sizes (slug — vCPU/RAM). Curated subset of DigitalOcean droplets. */
export const DOKS_NODE_SIZES = [
  's-2vcpu-2gb',
  's-2vcpu-4gb',
  's-4vcpu-8gb',
  's-8vcpu-16gb',
  'c-2-4gb',
  'c-4-8gb',
] as const

/** Clusters that actually appear in the apps inventory, in stable order. */
export const clustersFromApps = (apps: PlatformApp[]): string[] =>
  Array.from(new Set(apps.map((a) => a.cluster).filter(Boolean))).sort()
