// This structure is maintained to relate the frontend table definitions with the datastore table definitions.
// The frontend only sends the column names to the backend. This needs to be changed in the future to send column IDs.

import { UiColumnMappings } from "../../tableDefinitions";

export const eventsTableNativeUiColumnDefinitions: UiColumnMappings = [
  {
    uiTableName: "Environment",
    uiTableId: "environment",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."environment"',
  },
  {
    uiTableName: "Type",
    uiTableId: "type",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."type"',
  },
  {
    uiTableName: "ID",
    uiTableId: "id",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."span_id"',
  },
  {
    uiTableName: "Name",
    uiTableId: "name",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."name"',
  },
  {
    uiTableName: "Trace ID",
    uiTableId: "traceId",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."trace_id"',
  },

  {
    uiTableName: "Start Time",
    uiTableId: "startTime",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."start_time"',
  },
  {
    uiTableName: "End Time",
    uiTableId: "endTime",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."end_time"',
  },
  {
    uiTableName: "Time To First Token (s)",
    uiTableId: "timeToFirstToken",
    datastoreTableName: "events_proto",
    datastoreSelect:
      "if(isNull(e.completion_start_time), NULL,  date_diff('millisecond', e.start_time, e.completion_start_time) / 1000)",
    // If we use the default of Decimal64(12), we cannot filter for more than ~40min due to an overflow
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Latency (s)",
    uiTableId: "latency",
    datastoreTableName: "events_proto",
    datastoreSelect: "if(isNull(e.end_time), NULL, date_diff('millisecond', e.start_time, e.end_time) / 1000)",
    // If we use the default of Decimal64(12), we cannot filter for more than ~40min due to an overflow
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Tokens per second",
    uiTableId: "tokensPerSecond",
    datastoreTableName: "events_proto",
    datastoreSelect:
      "(arraySum(mapValues(mapFilter(x -> positionCaseInsensitive(x.1, 'output') > 0, usage_details))) / (date_diff('millisecond', start_time, end_time) / 1000))",
  },
  {
    uiTableName: "Input Cost ($)",
    uiTableId: "inputCost",
    datastoreTableName: "events_proto",
    datastoreSelect: "arraySum(mapValues(mapFilter(x -> positionCaseInsensitive(x.1, 'input') > 0, cost_details)))",
  },
  {
    uiTableName: "Output Cost ($)",
    uiTableId: "outputCost",
    datastoreTableName: "events_proto",
    datastoreSelect: "arraySum(mapValues(mapFilter(x -> positionCaseInsensitive(x.1, 'output') > 0, cost_details)))",
  },
  {
    uiTableName: "Total Cost ($)",
    uiTableId: "totalCost",
    datastoreTableName: "events_proto",
    datastoreSelect: "if(mapExists((k, v) -> (k = 'total'), cost_details), cost_details['total'], NULL)",
  },
  {
    uiTableName: "Level",
    uiTableId: "level",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."level"',
  },
  {
    uiTableName: "Status Message",
    uiTableId: "statusMessage",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."status_message"',
  },
  {
    uiTableName: "Model",
    uiTableId: "model",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."provided_model_name"',
  },
  {
    uiTableName: "Provided Model Name",
    uiTableId: "providedModelName",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."provided_model_name"',
  },
  {
    uiTableName: "Model ID",
    uiTableId: "modelId",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."model_id"',
  },
  {
    uiTableName: "Input Tokens",
    uiTableId: "inputTokens",
    datastoreTableName: "events_proto",
    datastoreSelect: "arraySum(mapValues(mapFilter(x -> positionCaseInsensitive(x.1, 'input') > 0, usage_details)))",
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Output Tokens",
    uiTableId: "outputTokens",
    datastoreTableName: "events_proto",
    datastoreSelect: "arraySum(mapValues(mapFilter(x -> positionCaseInsensitive(x.1, 'output') > 0, usage_details)))",
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Total Tokens",
    uiTableId: "totalTokens",
    datastoreTableName: "events_proto",
    datastoreSelect: "if(mapExists((k, v) -> (k = 'total'), usage_details), usage_details['total'], NULL)",
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Tokens",
    uiTableId: "tokens",
    datastoreTableName: "events_proto",
    datastoreSelect: "if(mapExists((k, v) -> (k = 'total'), usage_details), usage_details['total'], NULL)",
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Metadata",
    uiTableId: "metadata",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."metadata"',
  },
  {
    uiTableName: "Version",
    uiTableId: "version",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."version"',
  },
  {
    uiTableName: "Prompt Name",
    uiTableId: "promptName",
    datastoreTableName: "events_proto",
    datastoreSelect: "e.prompt_name",
  },
  {
    uiTableName: "Input",
    uiTableId: "input",
    datastoreTableName: "events_proto",
    datastoreSelect: "e.input",
  },
  {
    uiTableName: "Output",
    uiTableId: "output",
    datastoreTableName: "events_proto",
    datastoreSelect: "e.output",
  },
  {
    uiTableName: "Session ID",
    uiTableId: "sessionId",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."session_id"',
  },
  {
    uiTableName: "Trace Name",
    uiTableId: "traceName",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."trace_name"',
  },
  {
    uiTableName: "User ID",
    uiTableId: "userId",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."user_id"',
  },
  {
    uiTableName: "Trace Tags",
    uiTableId: "traceTags",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."tags"',
  },
  {
    uiTableName: "Tags",
    uiTableId: "tags",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."tags"',
  },
  {
    uiTableName: "Trace Environment",
    uiTableId: "traceEnvironment",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."environment"',
  },
  {
    uiTableName: "Has Parent Observation",
    uiTableId: "hasParentObservation",
    datastoreTableName: "events_proto",
    datastoreSelect: "e.parent_span_id != ''",
  },
  {
    uiTableName: "Parent Observation ID",
    uiTableId: "parentObservationId",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."parent_span_id"',
  },
  {
    uiTableName: "Experiment Dataset ID",
    uiTableId: "experimentDatasetId",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."experiment_dataset_id"',
  },
  {
    uiTableName: "Experiment ID",
    uiTableId: "experimentId",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."experiment_id"',
  },
  {
    uiTableName: "Experiment Name",
    uiTableId: "experimentName",
    datastoreTableName: "events_proto",
    datastoreSelect: 'e."experiment_name"',
  },
  {
    uiTableName: "Available Tools",
    uiTableId: "toolDefinitions",
    datastoreTableName: "events_proto",
    datastoreSelect: "length(mapKeys(e.tool_definitions))",
  },
  {
    uiTableName: "Tool Calls",
    uiTableId: "toolCalls",
    datastoreTableName: "events_proto",
    datastoreSelect: "length(e.tool_calls)",
  },
  {
    uiTableName: "Tool Names",
    uiTableId: "toolNames",
    datastoreTableName: "events_proto",
    datastoreSelect: "mapKeys(e.tool_definitions)",
  },
  {
    uiTableName: "Called Tool Names",
    uiTableId: "calledToolNames",
    datastoreTableName: "events_proto",
    datastoreSelect: "e.tool_call_names",
  },
];

export const eventsTableUiColumnDefinitions: UiColumnMappings = [
  ...eventsTableNativeUiColumnDefinitions,
  // Scores column duplicated to allow renaming column name. Will be removed once session storage cache is outdated
  // Column names are cached in user sessions - changing them breaks existing filters
  {
    uiTableName: "Scores",
    uiTableId: "scores",
    datastoreTableName: "scores",
    datastoreSelect: "s.scores_avg",
  },
  {
    uiTableName: "Scores (numeric)",
    uiTableId: "scores_avg",
    datastoreTableName: "scores",
    datastoreSelect: "s.scores_avg",
  },
  {
    uiTableName: "Scores (categorical)",
    uiTableId: "score_categories",
    datastoreTableName: "scores",
    datastoreSelect: "s.score_categories",
  },
  {
    uiTableName: "Comment Count",
    uiTableId: "commentCount",
    datastoreTableName: "comments",
    datastoreSelect: "", // handled by comment filter helpers
  },
  {
    uiTableName: "Comment Content",
    uiTableId: "commentContent",
    datastoreTableName: "comments",
    datastoreSelect: "", // handled by comment filter helpers
  },
];
