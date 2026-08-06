/**
 * Typed client for the unified Hanzo Cloud `/v1` backend.
 *
 * Endpoint surface (ported from hanzoai/ai web/src/backend/*.js), grouped by
 * resource. Every call goes through `client.ts` (cookie credentials, envelope
 * unwrapping, typed errors). Base URL is `config.cloudUrl` — same-origin in the
 * browser, and the ONE Hanzo API endpoint (https://api.hanzo.ai) off-origin.
 */
export { ApiError, type ApiResponse } from './client'
export * from './types'

export { AccountApi } from './account'
export { ProjectApi, projectEnvironments, type Project } from './projects'
export { BotApi, type BotHealth } from './bot'
export { PlansApi, type Plan, type PlanLimits } from './plans'
export {
  WalletApi,
  type CloudBalance,
  type WalletTopupRequest,
  type WalletTopupResult,
} from './wallet'
export { ProviderApi } from './providers'
export { ModelRouteApi } from './model-routes'
export {
  CloudModelApi,
  providerLabels,
  type CloudModel,
  type CatalogModel,
  type ModelPricing,
} from './models-catalog'
export { StoreApi } from './stores'
export {
  EmbeddingsApi,
  type EmbeddingHit,
  type SearchMode,
  type SearchInput,
  type IndexStats,
  type FileRow,
  type EmbeddingResult,
  type IngestSource,
  type IngestStats,
} from './embeddings'
export { ChatApi } from './chats'
export { MessageApi } from './messages'
export {
  ProvisioningApi,
  type ResourceKind,
  type Resource,
  type ResourceCreated,
} from './provisioning'
export {
  PlatformApi,
  clustersFromApps,
  DOKS_REGIONS,
  DOKS_NODE_SIZES,
  type Cluster,
  type NodePool,
  type ClusterKind,
  type ProvisionClusterInput,
  type AttachClusterInput,
  type AddPoolInput,
  type PlatformApp,
  type AppHealth,
  type AppDriftFlag,
  type AppsQuery,
} from './platform'
export {
  PaasApi,
  type PaasProject,
  type PaasApp,
  type PaasAppWithProject,
  type PaasDeployment,
  type PaasEnvVar,
  type CreateProjectInput,
  type CreateAppInput,
  type DeployInput,
} from './paas'
export {
  IamAdminApi,
  KmsAdminApi,
  type Paged,
  type Organization,
  type ThemeData,
  type IamUser,
  type IamApplication,
  type IamProvider,
  type Role,
  type AuditRecord,
  type KmsSecretMeta,
  type KmsSecretValue,
  type KmsScope,
  type KmsRef,
} from './admin'
export {
  NodesApi,
  NODE_NETWORK_META,
  normalizeValidators,
  normalizePeers,
  combineInventory,
  parseUptimePct,
  parseHeight,
  fmtUptime,
  fmtHeight,
  fmtWeight,
  type NodeRow,
  type NodeRole,
  type NodeStatus,
  type NodeNetworkId,
  type NetworkInventory,
  type RawValidator,
  type RawPeer,
} from './nodes'
export { TeamApi } from './team'
export {
  PlaygroundApi,
  type ChatMessage,
  type ChatUsage,
  type ChatCompletion,
  type ChatRequest,
  type StreamMessage,
  type ChatStreamRequest,
  type EmbeddingsRequest,
  type EmbeddingsResponse,
  type SpeechRequest,
  type ImageRequest,
  type ImageResponse,
  type VideoRequest,
  type VideoResponse,
} from './playground'
export { AiApi, type AiChatInput } from './ai'
export { KeysApi, type KeyStatus } from './keys'
export {
  PromptsApi,
  normalizePrompt,
  normalizePrompts,
  normalizeMetricRows,
  type Prompt,
  type NewPromptBody,
  type PromptMetricRow,
} from './prompts'
export {
  EvalsApi,
  type EvalScore,
  type EvalScoresPage,
  type EvalDataset,
  type EvalDatasetItem,
  type EvalDatasetRun,
  type EvalItemResult,
  type EvalRunSummary,
  type EvalRunRequest,
  type CreateDatasetBody,
  type CreateDatasetItemBody,
} from './evals'
export {
  MemoryApi,
  MEMORY_KINDS,
  type Memory,
  type MemoryKind,
  type MemoryFact,
  type RememberInput,
  type UpdateInput,
} from './memory'
export {
  TasksApi,
  type ClusterHealth,
  type ClusterStatus,
  type Namespace,
  type NamespaceInfo,
  type WorkflowExecution,
  type WorkflowDetail,
  type HistoryEvent,
  type Schedule,
  type TaskQueue,
  type Worker,
  type ActivityInfo,
} from './tasks'
export {
  TrainApi,
  TRAIN_TYPES,
  TRAIN_PRESETS,
  TRAIN_GPUS,
  type TrainJob,
  type TrainStatus,
  type TrainExperiment,
  type MetricPoint,
  type MlModel,
  type CreateTrainJobInput,
} from './train'
// Interactive training — the ENGINE plane (live LoRA client: forward_backward /
// optim_step / sample / save_weights), distinct from TrainApi's cloud k8s jobs.
export {
  TrainingApi,
  LLAMA_TARGET_MODULES,
  DEFAULT_LORA,
  normLoraConfig,
  normClientInfo,
  normClientDetail,
  normForwardBackward,
  normSampleResult,
  type LoraConfig,
  type TrainingClientStatus,
  type TrainingClientInfo,
  type TrainingClientDetail,
  type Datum,
  type PromptCompletion,
  type TokenDatum,
  type ForwardBackwardResult,
  type OptimStepResult,
  type AdamParams,
  type SamplingParams,
  type SampleInput,
  type SampleSequence,
  type SampleResult,
  type SaveWeightsResult,
  type CreateClientInput,
} from './training'
export {
  O11yApi,
  type O11yList,
  type O11yPageMeta,
  type O11yListQuery,
  type Trace,
  type Observation,
  type O11yUser,
  type Score,
  type Session,
  type ScoreConfig,
  type ScoreConfigCategory,
  type AnnotationQueue,
  type AnnotationQueueDetail,
  type AnnotationQueueItem,
  type TraceDetail,
  type SessionDetail,
} from './o11y'
export {
  TelemetryApi,
  windowOf,
  serviceNameOf,
  toServiceHealth,
  summarizeHealth,
  parseInstant,
  parseRange,
  type Sample,
  type Series,
  type ServiceHealth,
  type HealthSummary,
  type RangeWindow,
} from './telemetry'
export {
  LuxInfraApi,
  LUX_QUERIES,
  LUX_SERVICES,
  livenessOf,
  networkLabel,
  toNetworks,
  toNodeMemory,
  toTopPods,
  toServices,
  type LuxInfra,
  type Liveness,
  type ValidatorRow,
  type NetworkSummary,
  type NodeMem,
  type PodMem,
  type ServiceStatus,
} from './lux-infra'
export {
  ApmApi,
  apmWindow,
  normalizeService,
  normalizeServices,
  normalizeEdge,
  normalizeDependencies,
  normalizeTopOperations,
  normalizeHosts,
  normalizePods,
  normalizeNodes,
  normalizeException,
  normalizeExceptions,
  ErrorTrackingApi,
  normalizeIssue,
  normalizeIssues,
  normalizeIssueDetail,
  normalizeDashboard,
  normalizeDashboards,
  listQueryPayload,
  parseListRows,
  toIso,
  normalizeLogRow,
  normalizeLogs,
  normalizeTraceSpan,
  normalizeSpans,
  type ApmWindow,
  type ServiceRow,
  type DependencyEdge,
  type TopOperation,
  type HostRow,
  type PodRow,
  type NodeRow as ApmNodeRow, // distinct from nodes.ts NodeRow (blockchain nodes)
  type InfraList,
  type ExceptionGroup,
  type Issue,
  type IssueStatus,
  type IssueDetail,
  type Occurrence,
  type OccurrenceFrame,
  type IssuesQuery,
  type Dashboard,
  type O11ySignal,
  type LogRow,
  type TraceSpan,
} from './apm'
// Integrations connector framework. The value + its types are exported under
// `Integration*`-prefixed names so the connector `Provider` never collides with the
// AI-model `Provider` (from ./types). The pure normalizers stay importable directly
// from './integrations' (the unit test uses that path).
export { IntegrationsApi, GitHubApi } from './integrations'
export type {
  Provider as IntegrationProvider,
  Connection as IntegrationConnection,
  ConnectResult as IntegrationConnectResult,
  GitHubRepo,
  GitHubImportResult,
} from './integrations'
// White-label tenant provisioning — clusters/domain/package/brand over the /paas
// service-token proxy (REAL cluster ops, honest-not-connected domain/package/brand).
export {
  TenantsApi,
  type TenantCluster,
  type TenantDomain,
  type TenantBrandConfig,
  type BindDomainInput,
  type BrandInput,
} from './tenants'
