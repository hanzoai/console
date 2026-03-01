import { UiColumnMappings } from "./types";

// Make sure to update web/src/features/query/dashboardUiTableToViewMapping.ts if you make changes

export const dashboardColumnDefinitions: UiColumnMappings = [
  {
    uiTableName: "Trace Name",
    uiTableId: "traceName",
    datastoreTableName: "traces",
    datastoreSelect: 't."name"',
  },
  {
    uiTableName: "Tags",
    uiTableId: "traceTags",
    datastoreTableName: "traces",
    datastoreSelect: 't."tags"',
  },
  {
    uiTableName: "Timestamp",
    uiTableId: "timestamp",
    datastoreTableName: "traces",
    datastoreSelect: 't."timestamp"',
  },
  {
    datastoreTableName: "scores",
    datastoreSelect: "name",
    uiTableId: "scoreName",
    uiTableName: "Score Name",
  },
  {
    datastoreTableName: "scores",
    datastoreSelect: "timestamp",
    uiTableId: "scoreTimestamp",
    uiTableName: "Score Timestamp",
  },
  {
    datastoreTableName: "scores",
    datastoreSelect: "source",
    uiTableId: "scoreSource",
    uiTableName: "Score Source",
  },
  {
    datastoreTableName: "scores",
    datastoreSelect: "data_type",
    uiTableId: "scoreDataType",
    uiTableName: "Scores Data Type",
  },
  {
    datastoreTableName: "scores",
    datastoreSelect: "value",
    uiTableId: "value",
    uiTableName: "value",
  },
  {
    datastoreTableName: "observations",
    datastoreSelect: "o.start_time",
    uiTableId: "startTime",
    uiTableName: "Start Time",
  },
  {
    datastoreTableName: "observations",
    datastoreSelect: "o.end_time",
    uiTableId: "endTime",
    uiTableName: "End Time",
  },
  {
    datastoreTableName: "observations",
    datastoreSelect: "o.type",
    uiTableId: "type",
    uiTableName: "Type",
  },
  {
    datastoreTableName: "traces",
    datastoreSelect: "t.user_id",
    uiTableId: "userId",
    uiTableName: "User",
  },
  {
    datastoreTableName: "traces",
    datastoreSelect: "t.release",
    uiTableId: "release",
    uiTableName: "Release",
  },
  {
    datastoreTableName: "traces",
    datastoreSelect: "t.version",
    uiTableId: "version",
    uiTableName: "Version",
  },
  {
    datastoreTableName: "observations",
    datastoreSelect: "provided_model_name",
    uiTableId: "model",
    uiTableName: "Model",
  },
  {
    datastoreTableName: "observations",
    datastoreSelect: "mapKeys(tool_definitions)",
    uiTableId: "toolNames",
    uiTableName: "Tool Names",
  },
  {
    datastoreTableName: "traces",
    datastoreSelect: "environment",
    uiTableId: "environment",
    uiTableName: "Environment",
  },
];
