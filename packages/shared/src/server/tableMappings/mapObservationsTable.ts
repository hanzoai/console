// This structure is maintained to relate the frontend table definitions with the datastore table definitions.
// The frontend only sends the column names to the backend. This needs to be changed in the future to send column IDs.

import { UiColumnMappings } from "../../tableDefinitions";

export const observationsTableTraceUiColumnDefinitions: UiColumnMappings = [
  {
    uiTableName: "Trace Tags",
    uiTableId: "traceTags",
    datastoreTableName: "traces",
    datastoreSelect: "t.tags",
  },
  {
    uiTableName: "User ID",
    uiTableId: "userId",
    datastoreTableName: "traces",
    datastoreSelect: 't."user_id"',
  },
  {
    uiTableName: "Session ID",
    uiTableId: "sessionId",
    datastoreTableName: "traces",
    datastoreSelect: 't."session_id"',
  },
  {
    uiTableName: "Trace Name",
    uiTableId: "traceName",
    datastoreTableName: "traces",
    datastoreSelect: 't."name"',
  },
  {
    uiTableName: "Trace Environment",
    uiTableId: "traceEnvironment",
    datastoreTableName: "traces",
    datastoreSelect: 't."environment"',
  },
];

export const observationsTableUiColumnDefinitions: UiColumnMappings = [
  ...observationsTableTraceUiColumnDefinitions,
  {
    uiTableName: "Environment",
    uiTableId: "environment",
    datastoreTableName: "observations",
    datastoreSelect: 'o."environment"',
  },
  {
    uiTableName: "type",
    uiTableId: "type",
    datastoreTableName: "observations",
    datastoreSelect: 'o."type"',
  },
  {
    uiTableName: "ID",
    uiTableId: "id",
    datastoreTableName: "observations",
    datastoreSelect: 'o."id"',
  },
  {
    uiTableName: "Type",
    uiTableId: "type",
    datastoreTableName: "observations",
    datastoreSelect: 'o."type"',
  },
  {
    uiTableName: "Name",
    uiTableId: "name",
    datastoreTableName: "observations",
    datastoreSelect: 'o."name"',
  },
  {
    uiTableName: "Trace ID",
    uiTableId: "traceId",
    datastoreTableName: "observations",
    datastoreSelect: 'o."trace_id"',
  },
  {
    uiTableName: "Parent Observation ID",
    uiTableId: "parentObservationId",
    datastoreTableName: "observations",
    datastoreSelect: 'o."parent_observation_id"',
  },

  {
    uiTableName: "Start Time",
    uiTableId: "startTime",
    datastoreTableName: "observations",
    datastoreSelect: 'o."start_time"',
  },
  {
    uiTableName: "End Time",
    uiTableId: "endTime",
    datastoreTableName: "observations",
    datastoreSelect: 'o."end_time"',
  },
  {
    uiTableName: "Time To First Token (s)",
    uiTableId: "timeToFirstToken",
    datastoreTableName: "observations",
    datastoreSelect:
      "if(isNull(completion_start_time), NULL,  date_diff('millisecond', start_time, completion_start_time) / 1000)",
    // If we use the default of Decimal64(12), we cannot filter for more than ~40min due to an overflow
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Latency (s)",
    uiTableId: "latency",
    datastoreTableName: "observations",
    datastoreSelect: "if(isNull(end_time), NULL, date_diff('millisecond', start_time, end_time) / 1000)",
    // If we use the default of Decimal64(12), we cannot filter for more than ~40min due to an overflow
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Tokens per second",
    uiTableId: "tokensPerSecond",
    datastoreTableName: "observations",
    datastoreSelect:
      "(arraySum(mapValues(mapFilter(x -> positionCaseInsensitive(x.1, 'output') > 0, usage_details))) / (date_diff('millisecond', start_time, end_time) / 1000))",
  },
  {
    uiTableName: "Input Cost ($)",
    uiTableId: "inputCost",
    datastoreTableName: "observations",
    datastoreSelect: "arraySum(mapValues(mapFilter(x -> positionCaseInsensitive(x.1, 'input') > 0, cost_details)))",
  },
  {
    uiTableName: "Output Cost ($)",
    uiTableId: "outputCost",
    datastoreTableName: "observations",
    datastoreSelect: "arraySum(mapValues(mapFilter(x -> positionCaseInsensitive(x.1, 'output') > 0, cost_details)))",
  },
  {
    uiTableName: "Total Cost ($)",
    uiTableId: "totalCost",
    datastoreTableName: "observations",
    datastoreSelect: "if(mapExists((k, v) -> (k = 'total'), cost_details), cost_details['total'], NULL)",
  },
  {
    uiTableName: "Level",
    uiTableId: "level",
    datastoreTableName: "observations",
    datastoreSelect: 'o."level"',
  },
  {
    uiTableName: "Status Message",
    uiTableId: "statusMessage",
    datastoreTableName: "observations",
    datastoreSelect: 'o."status_message"',
  },
  {
    uiTableName: "Model",
    uiTableId: "model",
    datastoreTableName: "observations",
    datastoreSelect: 'o."provided_model_name"',
  },
  {
    uiTableName: "Model ID",
    uiTableId: "modelId",
    datastoreTableName: "observations",
    datastoreSelect: 'o."internal_model_id"',
  },
  {
    uiTableName: "Input Tokens",
    uiTableId: "inputTokens",
    datastoreTableName: "observations",
    datastoreSelect: "arraySum(mapValues(mapFilter(x -> positionCaseInsensitive(x.1, 'input') > 0, usage_details)))",
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Output Tokens",
    uiTableId: "outputTokens",
    datastoreTableName: "observations",
    datastoreSelect: "arraySum(mapValues(mapFilter(x -> positionCaseInsensitive(x.1, 'output') > 0, usage_details)))",
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Total Tokens",
    uiTableId: "totalTokens",
    datastoreTableName: "observations",
    datastoreSelect: "if(mapExists((k, v) -> (k = 'total'), usage_details), usage_details['total'], NULL)",
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Tokens",
    uiTableId: "tokens",
    datastoreTableName: "observations",
    datastoreSelect: "if(mapExists((k, v) -> (k = 'total'), usage_details), usage_details['total'], NULL)",
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Metadata",
    uiTableId: "metadata",
    datastoreTableName: "observations",
    datastoreSelect: 'o."metadata"',
  },
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
    uiTableName: "Version",
    uiTableId: "version",
    datastoreTableName: "observations",
    datastoreSelect: 'o."version"',
  },
  {
    uiTableName: "Prompt Name",
    uiTableId: "promptName",
    datastoreTableName: "observations",
    datastoreSelect: "o.prompt_name",
  },
  {
    uiTableName: "Prompt Version",
    uiTableId: "promptVersion",
    datastoreTableName: "observations",
    datastoreSelect: "o.prompt_version",
  },
  {
    uiTableName: "Available Tools",
    uiTableId: "toolDefinitions",
    datastoreTableName: "observations",
    datastoreSelect: "length(mapKeys(o.tool_definitions))",
  },
  {
    uiTableName: "Tool Calls",
    uiTableId: "toolCalls",
    datastoreTableName: "observations",
    datastoreSelect: "length(o.tool_calls)",
  },
  {
    uiTableName: "Tool Names",
    uiTableId: "toolNames",
    datastoreTableName: "observations",
    datastoreSelect: "mapKeys(o.tool_definitions)",
  },
  {
    uiTableName: "Called Tool Names",
    uiTableId: "calledToolNames",
    datastoreTableName: "observations",
    datastoreSelect: "o.tool_call_names",
  },
];
