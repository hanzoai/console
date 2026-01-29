// Standard analytics event types for analytics integrations (PostHog, Mixpanel, etc.)
// These represent the raw data structure from ClickHouse queries

export type AnalyticsTraceEvent = {
  hanzo_id: unknown;
  timestamp: unknown;
  hanzo_trace_name?: unknown;
  hanzo_url?: unknown;
  hanzo_user_url?: unknown;
  hanzo_cost_usd?: unknown;
  hanzo_count_observations?: unknown;
  hanzo_session_id?: unknown;
  hanzo_project_id?: unknown;
  hanzo_user_id?: unknown;
  hanzo_latency?: unknown;
  hanzo_release?: unknown;
  hanzo_version?: unknown;
  hanzo_tags?: unknown;
  hanzo_environment?: unknown;
  hanzo_event_version?: unknown;
  posthog_session_id?: unknown;
  mixpanel_session_id?: unknown;
};

export type AnalyticsGenerationEvent = {
  hanzo_id: unknown;
  timestamp: unknown;
  hanzo_generation_name?: unknown;
  hanzo_trace_name?: unknown;
  hanzo_trace_id?: unknown;
  hanzo_url?: unknown;
  hanzo_user_url?: unknown;
  hanzo_cost_usd?: unknown;
  hanzo_input_units?: unknown;
  hanzo_output_units?: unknown;
  hanzo_total_units?: unknown;
  hanzo_session_id?: unknown;
  hanzo_project_id?: unknown;
  hanzo_user_id?: unknown;
  hanzo_latency?: unknown;
  hanzo_time_to_first_token?: unknown;
  hanzo_release?: unknown;
  hanzo_version?: unknown;
  hanzo_model?: unknown;
  hanzo_level?: unknown;
  hanzo_tags?: unknown;
  hanzo_environment?: unknown;
  hanzo_event_version?: unknown;
  posthog_session_id?: unknown;
  mixpanel_session_id?: unknown;
};

export type AnalyticsScoreEvent = {
  hanzo_id: unknown;
  timestamp: unknown;
  hanzo_score_name?: unknown;
  hanzo_score_value?: unknown;
  hanzo_score_comment?: unknown;
  hanzo_score_metadata?: unknown;
  hanzo_score_string_value?: unknown;
  hanzo_score_data_type?: unknown;
  hanzo_trace_name?: unknown;
  hanzo_trace_id?: unknown;
  hanzo_user_url?: unknown;
  hanzo_session_id?: unknown;
  hanzo_project_id?: unknown;
  hanzo_user_id?: unknown;
  hanzo_release?: unknown;
  hanzo_tags?: unknown;
  hanzo_environment?: unknown;
  hanzo_event_version?: unknown;
  hanzo_score_entity_type?: unknown;
  hanzo_dataset_run_id?: unknown;
  posthog_session_id?: unknown;
  mixpanel_session_id?: unknown;
};
