import type { ColumnType } from 'kysely';
export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export const BlobStorageIntegrationType = {
  S3: 'S3',
  S3_COMPATIBLE: 'S3_COMPATIBLE',
  AZURE_BLOB_STORAGE: 'AZURE_BLOB_STORAGE',
} as const;
export type BlobStorageIntegrationType =
  (typeof BlobStorageIntegrationType)[keyof typeof BlobStorageIntegrationType];
export const Role = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
  NONE: 'NONE',
  ADMIN_BILLING: 'ADMIN_BILLING',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const LegacyPrismaObservationType = {
  SPAN: 'SPAN',
  EVENT: 'EVENT',
  GENERATION: 'GENERATION',
} as const;
export type LegacyPrismaObservationType =
  (typeof LegacyPrismaObservationType)[keyof typeof LegacyPrismaObservationType];
export const LegacyPrismaObservationLevel = {
  DEBUG: 'DEBUG',
  DEFAULT: 'DEFAULT',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
} as const;
export type LegacyPrismaObservationLevel =
  (typeof LegacyPrismaObservationLevel)[keyof typeof LegacyPrismaObservationLevel];
export const LegacyPrismaScoreSource = {
  ANNOTATION: 'ANNOTATION',
  API: 'API',
  EVAL: 'EVAL',
} as const;
export type LegacyPrismaScoreSource =
  (typeof LegacyPrismaScoreSource)[keyof typeof LegacyPrismaScoreSource];
export const ScoreDataType = {
  CATEGORICAL: 'CATEGORICAL',
  NUMERIC: 'NUMERIC',
  BOOLEAN: 'BOOLEAN',
} as const;
export type ScoreDataType = (typeof ScoreDataType)[keyof typeof ScoreDataType];
export const AnnotationQueueStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
} as const;
export type AnnotationQueueStatus =
  (typeof AnnotationQueueStatus)[keyof typeof AnnotationQueueStatus];
export const AnnotationQueueObjectType = {
  TRACE: 'TRACE',
  OBSERVATION: 'OBSERVATION',
} as const;
export type AnnotationQueueObjectType =
  (typeof AnnotationQueueObjectType)[keyof typeof AnnotationQueueObjectType];
export const DatasetStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;
export type DatasetStatus = (typeof DatasetStatus)[keyof typeof DatasetStatus];
export const CommentObjectType = {
  TRACE: 'TRACE',
  OBSERVATION: 'OBSERVATION',
  SESSION: 'SESSION',
  PROMPT: 'PROMPT',
} as const;
export type CommentObjectType =
  (typeof CommentObjectType)[keyof typeof CommentObjectType];
export const JobType = {
  EVAL: 'EVAL',
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];
export const JobConfigState = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type JobConfigState =
  (typeof JobConfigState)[keyof typeof JobConfigState];
export const JobExecutionStatus = {
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
  PENDING: 'PENDING',
  CANCELLED: 'CANCELLED',
} as const;
export type JobExecutionStatus =
  (typeof JobExecutionStatus)[keyof typeof JobExecutionStatus];
export const UsageMeterType = {
  AI: 'AI',
  STORAGE: 'STORAGE',
  NETWORK: 'NETWORK',
  NETWORK_EGRESS: 'NETWORK_EGRESS',
  GPU: 'GPU',
  CPU: 'CPU',
  MEMORY: 'MEMORY',
} as const;
export type UsageMeterType =
  (typeof UsageMeterType)[keyof typeof UsageMeterType];
export const UsageAggregationMethod = {
  SUM: 'SUM',
  AVERAGE: 'AVERAGE',
  MAX: 'MAX',
  MIN: 'MIN',
  LAST: 'LAST',
} as const;
export type UsageAggregationMethod =
  (typeof UsageAggregationMethod)[keyof typeof UsageAggregationMethod];
export type Account = {
  id: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
  user_id: string;
  expires_in: number | null;
  ext_expires_in: number | null;
  refresh_token_expires_in: number | null;
  created_at: number | null;
};
export type AnnotationQueue = {
  id: string;
  name: string;
  description: string | null;
  score_config_ids: Generated<string[]>;
  project_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type AnnotationQueueItem = {
  id: string;
  queue_id: string;
  object_id: string;
  object_type: AnnotationQueueObjectType;
  status: Generated<AnnotationQueueStatus>;
  locked_at: Timestamp | null;
  locked_by_user_id: string | null;
  annotator_user_id: string | null;
  completed_at: Timestamp | null;
  project_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type ApiKey = {
  id: string;
  created_at: Generated<Timestamp>;
  note: string | null;
  public_key: string;
  hashed_secret_key: string;
  display_secret_key: string;
  last_used_at: Timestamp | null;
  expires_at: Timestamp | null;
  project_id: string;
  fast_hashed_secret_key: string | null;
};
export type AuditLog = {
  id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  user_id: string;
  project_id: string | null;
  resource_type: string;
  resource_id: string;
  action: string;
  before: string | null;
  after: string | null;
  org_id: string;
  user_org_role: string;
  user_project_role: string | null;
};
export type BackgroundMigration = {
  id: string;
  name: string;
  script: string;
  args: unknown;
  finished_at: Timestamp | null;
  failed_at: Timestamp | null;
  failed_reason: string | null;
  worker_id: string | null;
  locked_at: Timestamp | null;
  state: Generated<unknown>;
};
export type BatchExport = {
  id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  project_id: string;
  user_id: string;
  finished_at: Timestamp | null;
  expires_at: Timestamp | null;
  name: string;
  status: string;
  query: unknown;
  format: string;
  url: string | null;
  log: string | null;
};
export type BillingMeterBackup = {
  stripe_customer_id: string;
  meter_id: string;
  start_time: Timestamp;
  end_time: Timestamp;
  aggregated_value: number;
  event_name: string;
  org_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type BlobStorageIntegration = {
  project_id: string;
  type: BlobStorageIntegrationType;
  bucket_name: string;
  prefix: string;
  access_key_id: string;
  secret_access_key: string;
  region: string;
  endpoint: string | null;
  force_path_style: boolean;
  next_sync_at: Timestamp | null;
  last_sync_at: Timestamp | null;
  enabled: boolean;
  export_frequency: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type Comment = {
  id: string;
  project_id: string;
  object_type: CommentObjectType;
  object_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  content: string;
  author_user_id: string | null;
};
export type CronJobs = {
  name: string;
  last_run: Timestamp | null;
  state: string | null;
  job_started_at: Timestamp | null;
};
export type Dataset = {
  id: string;
  name: string;
  project_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  description: string | null;
  metadata: unknown | null;
};
export type DatasetItem = {
  id: string;
  input: unknown | null;
  expected_output: unknown | null;
  source_observation_id: string | null;
  dataset_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  status: Generated<DatasetStatus>;
  source_trace_id: string | null;
  metadata: unknown | null;
  project_id: string;
};
export type DatasetRunItems = {
  id: string;
  dataset_run_id: string;
  dataset_item_id: string;
  observation_id: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  trace_id: string;
  project_id: string;
};
export type DatasetRuns = {
  id: string;
  name: string;
  dataset_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  metadata: unknown | null;
  description: string | null;
  project_id: string;
};
export type EvalTemplate = {
  id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  project_id: string;
  name: string;
  version: number;
  prompt: string;
  model: string;
  model_params: unknown;
  vars: Generated<string[]>;
  output_schema: unknown;
  provider: string;
};
export type JobConfiguration = {
  id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  project_id: string;
  job_type: JobType;
  eval_template_id: string | null;
  score_name: string;
  filter: unknown;
  target_object: string;
  variable_mapping: unknown;
  sampling: string;
  delay: number;
  status: Generated<JobConfigState>;
  time_scope: Generated<string[]>;
};
export type JobExecution = {
  id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  project_id: string;
  job_configuration_id: string;
  status: JobExecutionStatus;
  start_time: Timestamp | null;
  end_time: Timestamp | null;
  error: string | null;
  job_input_trace_id: string | null;
  job_output_score_id: string | null;
  job_input_dataset_item_id: string | null;
  job_input_observation_id: string | null;
};
export type LegacyPrismaObservation = {
  id: string;
  name: string | null;
  start_time: Generated<Timestamp>;
  end_time: Timestamp | null;
  parent_observation_id: string | null;
  type: LegacyPrismaObservationType;
  trace_id: string | null;
  metadata: unknown | null;
  model: string | null;
  modelParameters: unknown | null;
  input: unknown | null;
  output: unknown | null;
  level: Generated<LegacyPrismaObservationLevel>;
  status_message: string | null;
  completion_start_time: Timestamp | null;
  completion_tokens: Generated<number>;
  prompt_tokens: Generated<number>;
  total_tokens: Generated<number>;
  version: string | null;
  project_id: string;
  created_at: Generated<Timestamp>;
  unit: string | null;
  prompt_id: string | null;
  input_cost: string | null;
  output_cost: string | null;
  total_cost: string | null;
  internal_model: string | null;
  updated_at: Generated<Timestamp>;
  calculated_input_cost: string | null;
  calculated_output_cost: string | null;
  calculated_total_cost: string | null;
  internal_model_id: string | null;
};
export type LegacyPrismaScore = {
  id: string;
  timestamp: Generated<Timestamp>;
  name: string;
  value: number | null;
  observation_id: string | null;
  trace_id: string;
  comment: string | null;
  source: LegacyPrismaScoreSource;
  project_id: string;
  author_user_id: string | null;
  config_id: string | null;
  data_type: Generated<ScoreDataType>;
  string_value: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  queue_id: string | null;
};
export type LegacyPrismaTrace = {
  id: string;
  timestamp: Generated<Timestamp>;
  name: string | null;
  project_id: string;
  metadata: unknown | null;
  external_id: string | null;
  user_id: string | null;
  release: string | null;
  version: string | null;
  public: Generated<boolean>;
  bookmarked: Generated<boolean>;
  input: unknown | null;
  output: unknown | null;
  session_id: string | null;
  tags: Generated<string[]>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type LlmApiKeys = {
  id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  provider: string;
  display_secret_key: string;
  secret_key: string;
  project_id: string;
  base_url: string | null;
  adapter: string;
  custom_models: Generated<string[]>;
  with_default_models: Generated<boolean>;
  config: unknown | null;
  extra_headers: string | null;
  extra_header_keys: Generated<string[]>;
};
export type Media = {
  id: string;
  sha_256_hash: string;
  project_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  uploaded_at: Timestamp | null;
  upload_http_status: number | null;
  upload_http_error: string | null;
  bucket_path: string;
  bucket_name: string;
  content_type: string;
  content_length: string;
};
export type MembershipInvitation = {
  id: string;
  email: string;
  project_id: string | null;
  invited_by_user_id: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  org_id: string;
  org_role: Role;
  project_role: Role | null;
};
export type Model = {
  id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  project_id: string | null;
  model_name: string;
  match_pattern: string;
  start_date: Timestamp | null;
  input_price: string | null;
  output_price: string | null;
  total_price: string | null;
  unit: string | null;
  tokenizer_config: unknown | null;
  tokenizer_id: string | null;
};
export type ObservationMedia = {
  id: string;
  project_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  media_id: string;
  trace_id: string;
  observation_id: string;
  field: string;
};
export type Organization = {
  id: string;
  name: string;
  cloud_config: unknown | null;
  credits: Generated<number>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  expired_at: Timestamp | null;
};
export type OrganizationMembership = {
  id: string;
  org_id: string;
  user_id: string;
  role: Role;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type PosthogIntegration = {
  project_id: string;
  encrypted_posthog_api_key: string;
  posthog_host_name: string;
  last_sync_at: Timestamp | null;
  enabled: boolean;
  created_at: Generated<Timestamp>;
};
export type Price = {
  id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  model_id: string;
  usage_type: string;
  price: string;
};
export type Project = {
  id: string;
  created_at: Generated<Timestamp>;
  name: string;
  updated_at: Generated<Timestamp>;
  org_id: string;
  deleted_at: Timestamp | null;
  retention_days: number | null;
};
export type ProjectMembership = {
  project_id: string;
  user_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  org_membership_id: string;
  role: Role;
};
export type Prompt = {
  id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  project_id: string;
  created_by: string;
  name: string;
  version: number;
  is_active: boolean | null;
  config: Generated<unknown>;
  prompt: unknown;
  type: Generated<string>;
  tags: Generated<string[]>;
  labels: Generated<string[]>;
  commit_message: string | null;
};
export type QueueBackUp = {
  id: string;
  project_id: string | null;
  queue_name: string;
  content: unknown;
  created_at: Generated<Timestamp>;
};
export type ScoreConfig = {
  id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  project_id: string;
  name: string;
  data_type: ScoreDataType;
  is_archived: Generated<boolean>;
  min_value: number | null;
  max_value: number | null;
  categories: unknown | null;
  description: string | null;
};
export type Session = {
  id: string;
  expires: Timestamp;
  session_token: string;
  user_id: string;
};
export type SsoConfig = {
  domain: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  auth_provider: string;
  auth_config: unknown | null;
};
export type TraceMedia = {
  id: string;
  project_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  media_id: string;
  trace_id: string;
  field: string;
};
export type TraceSession = {
  id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  project_id: string;
  bookmarked: Generated<boolean>;
  public: Generated<boolean>;
  environment: Generated<string>;
};
export type UsageMeter = {
  id: string;
  organization_id: string;
  name: string;
  type: UsageMeterType;
  unit: string;
  aggregation_method: UsageAggregationMethod;
  currentValue: Generated<number>;
  last_reset_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type UsageRecord = {
  id: string;
  organization_id: string;
  usage_meter_id: string;
  value: number;
  timestamp: Generated<Timestamp>;
  metadata: unknown | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type User = {
  id: string;
  name: string | null;
  email: string | null;
  email_verified: Timestamp | null;
  password: string | null;
  image: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  feature_flags: Generated<string[]>;
  admin: Generated<boolean>;
};
export type VerificationToken = {
  identifier: string;
  token: string;
  expires: Timestamp;
};
export type DB = {
  Account: Account;
  annotation_queue_items: AnnotationQueueItem;
  annotation_queues: AnnotationQueue;
  api_keys: ApiKey;
  audit_logs: AuditLog;
  background_migrations: BackgroundMigration;
  batch_exports: BatchExport;
  billing_meter_backups: BillingMeterBackup;
  blob_storage_integrations: BlobStorageIntegration;
  comments: Comment;
  cron_jobs: CronJobs;
  dataset_items: DatasetItem;
  dataset_run_items: DatasetRunItems;
  dataset_runs: DatasetRuns;
  datasets: Dataset;
  eval_templates: EvalTemplate;
  job_configurations: JobConfiguration;
  job_executions: JobExecution;
  llm_api_keys: LlmApiKeys;
  media: Media;
  membership_invitations: MembershipInvitation;
  models: Model;
  observation_media: ObservationMedia;
  observations: LegacyPrismaObservation;
  organization_memberships: OrganizationMembership;
  organizations: Organization;
  posthog_integrations: PosthogIntegration;
  prices: Price;
  project_memberships: ProjectMembership;
  projects: Project;
  prompts: Prompt;
  queue_backups: QueueBackUp;
  score_configs: ScoreConfig;
  scores: LegacyPrismaScore;
  Session: Session;
  sso_configs: SsoConfig;
  trace_media: TraceMedia;
  trace_sessions: TraceSession;
  traces: LegacyPrismaTrace;
  usage_meters: UsageMeter;
  usage_records: UsageRecord;
  users: User;
  verification_tokens: VerificationToken;
};
