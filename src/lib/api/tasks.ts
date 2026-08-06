/**
 * Tasks API — the durable workflow engine (hanzoai/tasks `tasksd`, the native
 * Temporal-style HTTP surface), unified into the console. Every call goes through
 * the console's OWN same-origin `/tasks` proxy (`app/tasks/[...path]/route.ts`),
 * which mints a short-lived user Bearer JWT server-side (tasksd requires a Bearer
 * and strips client identity headers, minting org from the token's `owner` claim).
 * The browser sends the session cookie only. The engine returns named-key JSON
 * (`{ executions:[…] }`, `{ taskQueues:[…] }`, …) at 200, or `{ error, code }`.
 * Honest states render when a route is gated/absent/unreachable.
 *
 * Contract verified against hanzoai/tasks `pkg/tasks/embed.go`: namespaces group
 * an org's work (one per org); one workflow execution is one durable "task"; task
 * queues + workers + activities complete the Temporal-console read surface. NOTE:
 * public `tasks.hanzo.ai` TLS is not live yet — the real path is the in-cluster
 * service the proxy targets (TASKS_URL); elsewhere the honest BackendStateCard shows.
 */
import { restGet, originV1Url } from './client'

/** Cluster liveness — `{ status: "ok" | "down" }`. */
export type ClusterHealth = { status: string }

/** Cluster status — engine topology + replication counters. */
export type ClusterStatus = {
  nodeId?: string
  replicator?: string
  shardCount?: number
  openShards?: number
  validators?: string[]
  stats?: { accepted?: number; rejected?: number; timeouts?: number }
}

export type NamespaceInfo = {
  name: string
  state?: string
  description?: string
  ownerEmail?: string
  region?: string
  createTime?: string
}

/** A namespace — the per-org workflow tenant. */
export type Namespace = {
  namespaceInfo: NamespaceInfo
  config?: { workflowExecutionRetentionTtl?: string; apsLimit?: number }
  isActive?: boolean
}

/** A workflow execution — one durable "task". */
export type WorkflowExecution = {
  execution: { workflowId: string; runId: string }
  type: { name: string }
  status: string
  startTime?: string
  closeTime?: string
  taskQueue?: string
  historyLength?: number
}

/** Workflow detail — execution info plus its run config. */
export type WorkflowDetail = {
  workflowExecutionInfo: WorkflowExecution
  executionConfig?: { taskQueue?: { name: string } }
}

/** One event in a workflow's durable history. */
export type HistoryEvent = {
  eventId?: number
  eventTime?: string
  eventType?: string
  [k: string]: unknown
}

/** A schedule — a recurring (cron/interval) task. */
export type Schedule = {
  scheduleId: string
  namespace?: string
  state?: { paused?: boolean; note?: string }
  info?: { actionCount?: number; nextActionTime?: string; createTime?: string; updateTime?: string }
  action?: { workflowType?: { name?: string }; taskQueue?: string }
}

/** A task queue — the routing rendezvous for workflows + their workers. */
export type TaskQueue = {
  name: string
  workflows?: number
  running?: number
  latestStart?: string
  backlog?: number
  pollers?: number
}

/** A worker/poller registered against a task queue. */
export type Worker = {
  identity?: string
  taskQueue?: string
  lastAccessTime?: string
  ratePerSecond?: number
  workflowPollers?: number
  activityPollers?: number
}

/** One activity execution (a step within a workflow). */
export type ActivityInfo = {
  activityId?: string
  activityType?: { name?: string } | string
  workflowId?: string
  runId?: string
  state?: string
  status?: string
  attempt?: number
  scheduledTime?: string
  taskQueue?: string
}

/** `/v1/tasks/<path>` on the canonical API — the surface the retired `/tasksd`
 *  proxy forwarded to (`TASKS_URL` + `/v1/tasks/*`), now addressed directly.
 *
 *  The `/tasksd` spelling existed only to keep a SAME-ORIGIN proxy from shadowing
 *  the `/tasks/*` SPA routes the tasks product page owns. Addressing api.hanzo.ai
 *  absolutely removes that collision entirely — a path on the API host cannot
 *  shadow a client-side route — so the surface gets its real name back.
 *
 *  That proxy was a `route.ts`, and `scripts/build-embed.mjs` stashes EVERY route
 *  handler out of the static export the cloud binary serves, so on console.hanzo.ai
 *  `/tasksd/*` fell through to the SPA catch-all. Measured before this change:
 *    GET https://console.hanzo.ai/tasksd/health -> 200 369706B text/html
 *  and after, against the real surface:
 *    GET https://api.hanzo.ai/v1/tasks/health   -> 200 33B application/json */
const u = (path: string): string => originV1Url(`tasks/${path.replace(/^\/+/, '')}`)
const enc = encodeURIComponent

export const TasksApi = {
  /** Cluster liveness (unauthenticated probe). */
  health: (): Promise<ClusterHealth> => restGet<ClusterHealth>(u('cluster/health')),

  /** Cluster status — engine + replication counters. */
  cluster: (): Promise<ClusterStatus> => restGet<ClusterStatus>(u('cluster')),

  /** The caller-org's namespaces (honest empty when none registered). */
  namespaces: async (): Promise<Namespace[]> => {
    const r = await restGet<{ namespaces?: Namespace[] }>(u('namespaces'))
    return r?.namespaces ?? []
  },

  /** Workflow executions in a namespace — optionally a visibility query. */
  workflows: async (ns: string, query?: string): Promise<WorkflowExecution[]> => {
    const q = query ? `?query=${enc(query)}` : ''
    const r = await restGet<{ executions?: WorkflowExecution[] }>(u(`namespaces/${enc(ns)}/workflows${q}`))
    return r?.executions ?? []
  },

  /** One workflow's detail (latest run unless `runId` is given). */
  workflow: (ns: string, workflowId: string, runId?: string): Promise<WorkflowDetail> => {
    const q = runId ? `?runId=${enc(runId)}` : ''
    return restGet<WorkflowDetail>(u(`namespaces/${enc(ns)}/workflows/${enc(workflowId)}${q}`))
  },

  /** A workflow's durable history events (newest page first when reversed). */
  history: async (ns: string, workflowId: string, runId?: string): Promise<HistoryEvent[]> => {
    const p = new URLSearchParams({ pageSize: '50' })
    if (runId) p.set('runId', runId)
    const r = await restGet<{ events?: HistoryEvent[] }>(
      u(`namespaces/${enc(ns)}/workflows/${enc(workflowId)}/history?${p.toString()}`),
    )
    return r?.events ?? []
  },

  /** Schedules (recurring tasks) in a namespace. */
  schedules: async (ns: string): Promise<Schedule[]> => {
    const r = await restGet<{ schedules?: Schedule[] }>(u(`namespaces/${enc(ns)}/schedules`))
    return r?.schedules ?? []
  },

  /** Task queues in a namespace (aggregated from workflows by the engine). */
  taskQueues: async (ns: string): Promise<TaskQueue[]> => {
    const r = await restGet<{ taskQueues?: TaskQueue[] }>(u(`namespaces/${enc(ns)}/task-queues`))
    return r?.taskQueues ?? []
  },

  /** Registered workers/pollers in a namespace (empty until a worker heartbeats). */
  workers: async (ns: string): Promise<Worker[]> => {
    const r = await restGet<{ workers?: Worker[] }>(u(`namespaces/${enc(ns)}/workers`))
    return r?.workers ?? []
  },

  /** Activity executions (workflow steps) in a namespace. */
  activities: async (ns: string): Promise<ActivityInfo[]> => {
    const r = await restGet<{ activities?: ActivityInfo[] }>(u(`namespaces/${enc(ns)}/activities`))
    return r?.activities ?? []
  },
}
