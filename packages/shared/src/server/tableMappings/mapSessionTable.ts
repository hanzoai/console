import { UiColumnMappings } from "../../tableDefinitions";

export const sessionCols: UiColumnMappings = [
  // we do not access the traces scores in ClickHouse. We default back to the trace timestamps.

  {
    uiTableName: "⭐️",
    uiTableId: "bookmarked",
    datastoreTableName: "traces",
    datastoreSelect: "bookmarked",
  },
  {
    uiTableName: "Created At",
    uiTableId: "createdAt",
    datastoreTableName: "traces",
    datastoreSelect: "min_timestamp",
  },
  {
    uiTableName: "User IDs",
    uiTableId: "userIds",
    datastoreTableName: "traces",
    datastoreSelect: "user_ids",
  },
  {
    uiTableName: "Environment",
    uiTableId: "environment",
    datastoreTableName: "traces",
    datastoreSelect: "environment",
  },
  {
    uiTableName: "Session Duration",
    uiTableId: "sessionDuration",
    datastoreTableName: "traces",
    datastoreSelect: "duration",
    // If we use the default of Decimal64(12), we cannot filter for more than ~40min due to an overflow
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Count Traces",
    uiTableId: "countTraces",
    datastoreTableName: "traces",
    datastoreSelect: "trace_count",
  },
  {
    uiTableName: "Session Input Cost",
    uiTableId: "inputCost",
    datastoreTableName: "traces",
    datastoreSelect: "session_input_cost",
  },
  {
    uiTableName: "Session Output Cost",
    uiTableId: "outputCost",
    datastoreTableName: "traces",
    datastoreSelect: "session_output_cost",
  },
  {
    uiTableName: "Session Total Cost",
    uiTableId: "totalCost",
    datastoreTableName: "traces",
    datastoreSelect: "session_total_cost",
  },
  {
    uiTableName: "Input Tokens",
    uiTableId: "inputTokens",
    datastoreTableName: "traces",
    datastoreSelect: "session_input_usage",
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Output Tokens",
    uiTableId: "outputTokens",
    datastoreTableName: "traces",
    datastoreSelect: "session_output_usage",
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Total Tokens",
    uiTableId: "totalTokens",
    datastoreTableName: "traces",
    datastoreSelect: "session_total_usage",
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Usage",
    uiTableId: "totalTokens",
    datastoreTableName: "traces",
    datastoreSelect: "session_total_usage",
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Session Total Usage",
    uiTableId: "usage",
    datastoreTableName: "traces",
    datastoreSelect: "session_total_usage",
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Session Duration (s)",
    uiTableId: "sessionDuration",
    datastoreTableName: "traces",
    datastoreSelect: "duration",
    // If we use the default of Decimal64(12), we cannot filter for more than ~40min due to an overflow
    datastoreTypeOverwrite: "Decimal64(3)",
  },
  {
    uiTableName: "Traces Count",
    uiTableId: "tracesCount",
    datastoreTableName: "traces",
    datastoreSelect: "trace_count",
  },
  {
    uiTableName: "Input Cost ($)",
    uiTableId: "inputCost",
    datastoreTableName: "traces",
    datastoreSelect: "session_input_cost",
  },
  {
    uiTableName: "Output Cost ($)",
    uiTableId: "outputCost",
    datastoreTableName: "traces",
    datastoreSelect: "session_output_cost",
  },
  {
    uiTableName: "Total Cost ($)",
    uiTableId: "totalCost",
    datastoreTableName: "traces",
    datastoreSelect: "session_total_cost",
  },
  {
    uiTableName: "Trace Tags",
    uiTableId: "traceTags",
    datastoreTableName: "traces",
    datastoreSelect: "trace_tags",
  },
  {
    uiTableName: "ID",
    uiTableId: "id",
    datastoreTableName: "traces",
    datastoreSelect: "session_id",
  },
  {
    uiTableName: "Scores (numeric)",
    uiTableId: "scores_avg",
    datastoreTableName: "scores",
    datastoreSelect: "scores_avg",
  },
  {
    uiTableName: "Scores (categorical)",
    uiTableId: "score_categories",
    datastoreTableName: "scores",
    datastoreSelect: "score_categories",
  },
];
