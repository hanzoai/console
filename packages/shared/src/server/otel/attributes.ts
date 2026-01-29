export enum HanzoOtelSpanAttributes {
  // Hanzo-Trace attributes
  TRACE_NAME = "hanzo.trace.name",
  TRACE_USER_ID = "user.id",
  TRACE_SESSION_ID = "session.id",
  TRACE_TAGS = "hanzo.trace.tags",
  TRACE_PUBLIC = "hanzo.trace.public",
  TRACE_METADATA = "hanzo.trace.metadata",
  TRACE_INPUT = "hanzo.trace.input",
  TRACE_OUTPUT = "hanzo.trace.output",

  // Hanzo-observation attributes
  OBSERVATION_TYPE = "hanzo.observation.type",
  OBSERVATION_METADATA = "hanzo.observation.metadata",
  OBSERVATION_LEVEL = "hanzo.observation.level",
  OBSERVATION_STATUS_MESSAGE = "hanzo.observation.status_message",
  OBSERVATION_INPUT = "hanzo.observation.input",
  OBSERVATION_OUTPUT = "hanzo.observation.output",

  // Hanzo-observation of type Generation attributes
  OBSERVATION_COMPLETION_START_TIME = "hanzo.observation.completion_start_time",
  OBSERVATION_MODEL = "hanzo.observation.model.name",
  OBSERVATION_MODEL_PARAMETERS = "hanzo.observation.model.parameters",
  OBSERVATION_USAGE_DETAILS = "hanzo.observation.usage_details",
  OBSERVATION_COST_DETAILS = "hanzo.observation.cost_details",
  OBSERVATION_PROMPT_NAME = "hanzo.observation.prompt.name",
  OBSERVATION_PROMPT_VERSION = "hanzo.observation.prompt.version",

  //   General
  ENVIRONMENT = "hanzo.environment",
  RELEASE = "hanzo.release",
  VERSION = "hanzo.version",

  // Internal
  AS_ROOT = "hanzo.internal.as_root",

  // Compatibility - Map properties that were documented in https://hanzo.com/docs/opentelemetry/get-started#property-mapping,
  // but have a new assignment
  TRACE_COMPAT_USER_ID = "hanzo.user.id",
  TRACE_COMPAT_SESSION_ID = "hanzo.session.id",

  // Experiment attributes
  EXPERIMENT_ID = "hanzo.experiment.id",
  EXPERIMENT_NAME = "hanzo.experiment.name",
  EXPERIMENT_METADATA = "hanzo.experiment.metadata",
  EXPERIMENT_DESCRIPTION = "hanzo.experiment.description",
  EXPERIMENT_DATASET_ID = "hanzo.experiment.dataset.id",
  EXPERIMENT_ITEM_ID = "hanzo.experiment.item.id",
  EXPERIMENT_ITEM_VERSION = "hanzo.experiment.item.version",
  EXPERIMENT_ITEM_METADATA = "hanzo.experiment.item.metadata",
  EXPERIMENT_ITEM_ROOT_OBSERVATION_ID = "hanzo.experiment.item.root_observation_id",
  EXPERIMENT_ITEM_EXPECTED_OUTPUT = "hanzo.experiment.item.expected_output",
}
