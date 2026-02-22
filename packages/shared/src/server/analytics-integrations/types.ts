// Standard analytics event types for analytics integrations (PostHog, Mixpanel, etc.)
// These represent the raw data structure from ClickHouse queries

export type AnalyticsTraceEvent = {
  console_id: unknown;
  timestamp: unknown;
  console_trace_name?: unknown;
  console_url?: unknown;
  console_user_url?: unknown;
  console_cost_usd?: unknown;
  console_count_observations?: unknown;
  console_session_id?: unknown;
  console_project_id?: unknown;
  console_project_name?: unknown;
  console_user_id?: unknown;
  console_latency?: unknown;
  console_release?: unknown;
  console_version?: unknown;
  console_tags?: unknown;
  console_environment?: unknown;
  console_event_version?: unknown;
  posthog_session_id?: unknown;
  mixpanel_session_id?: unknown;
};

export type AnalyticsGenerationEvent = {
  console_id: unknown;
  timestamp: unknown;
  console_generation_name?: unknown;
  console_trace_name?: unknown;
  console_trace_id?: unknown;
  console_url?: unknown;
  console_user_url?: unknown;
  console_cost_usd?: unknown;
  console_input_units?: unknown;
  console_output_units?: unknown;
  console_total_units?: unknown;
  console_session_id?: unknown;
  console_project_id?: unknown;
  console_project_name?: unknown;
  console_user_id?: unknown;
  console_latency?: unknown;
  console_time_to_first_token?: unknown;
  console_release?: unknown;
  console_version?: unknown;
  console_model?: unknown;
  console_level?: unknown;
  console_tags?: unknown;
  console_environment?: unknown;
  console_event_version?: unknown;
  posthog_session_id?: unknown;
  mixpanel_session_id?: unknown;
};

export type AnalyticsScoreEvent = {
  console_id: unknown;
  timestamp: unknown;
  console_score_name?: unknown;
  console_score_value?: unknown;
  console_score_comment?: unknown;
  console_score_metadata?: unknown;
  console_score_string_value?: unknown;
  console_score_data_type?: unknown;
  console_trace_name?: unknown;
  console_trace_id?: unknown;
  console_user_url?: unknown;
  console_session_id?: unknown;
  console_project_id?: unknown;
  console_project_name?: unknown;
  console_user_id?: unknown;
  console_release?: unknown;
  console_tags?: unknown;
  console_environment?: unknown;
  console_event_version?: unknown;
  console_score_entity_type?: unknown;
  console_dataset_run_id?: unknown;
  posthog_session_id?: unknown;
  mixpanel_session_id?: unknown;
};

export type AnalyticsObservationEvent = {
  console_id: unknown;
  timestamp: unknown;
  console_observation_name?: unknown;
  console_trace_name?: unknown;
  console_trace_id?: unknown;
  console_url?: unknown;
  console_user_url?: unknown;
  console_cost_usd?: unknown;
  console_input_units?: unknown;
  console_output_units?: unknown;
  console_total_units?: unknown;
  console_session_id?: unknown;
  console_project_id?: unknown;
  console_project_name?: unknown;
  console_user_id?: unknown;
  console_latency?: unknown;
  console_time_to_first_token?: unknown;
  console_release?: unknown;
  console_version?: unknown;
  console_model?: unknown;
  console_level?: unknown;
  console_type?: unknown;
  console_tags?: unknown;
  console_environment?: unknown;
  console_event_version?: unknown;
  posthog_session_id?: unknown;
  mixpanel_session_id?: unknown;
};
