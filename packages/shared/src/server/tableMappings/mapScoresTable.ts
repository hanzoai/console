import { UiColumnMappings } from "../../tableDefinitions";

export const scoresTableUiColumnDefinitions: UiColumnMappings = [
  {
    uiTableName: "ID",
    uiTableId: "id",
    datastoreTableName: "scores",
    datastoreSelect: "id",
  },
  {
    uiTableName: "Timestamp",
    uiTableId: "timestamp",
    datastoreTableName: "scores",
    datastoreSelect: "timestamp",
  },
  {
    uiTableName: "Environment",
    uiTableId: "environment",
    datastoreTableName: "scores",
    datastoreSelect: "environment",
  },
  {
    uiTableName: "Trace ID",
    uiTableId: "traceId",
    datastoreTableName: "scores",
    datastoreSelect: "trace_id",
  },
  {
    uiTableName: "Observation ID",
    uiTableId: "observationId",
    datastoreTableName: "scores",
    datastoreSelect: "observation_id",
  },
  {
    uiTableName: "Session ID",
    uiTableId: "sessionId",
    datastoreTableName: "scores",
    datastoreSelect: "session_id",
  },
  {
    uiTableName: "Name",
    uiTableId: "name",
    datastoreTableName: "scores",
    datastoreSelect: "name",
  },
  {
    uiTableName: "Value",
    uiTableId: "value",
    datastoreTableName: "scores",
    datastoreSelect: "value",
  },
  {
    uiTableName: "Source",
    uiTableId: "source",
    datastoreTableName: "scores",
    datastoreSelect: "source",
  },
  {
    uiTableName: "Comment",
    uiTableId: "comment",
    datastoreTableName: "scores",
    datastoreSelect: "comment",
  },
  {
    uiTableName: "Author User ID",
    uiTableId: "authorUserId",
    datastoreTableName: "scores",
    datastoreSelect: "author_user_id",
  },
  {
    uiTableName: "Data Type",
    uiTableId: "dataType",
    datastoreTableName: "scores",
    datastoreSelect: "data_type",
  },
  {
    uiTableName: "String Value",
    uiTableId: "stringValue",
    datastoreTableName: "scores",
    datastoreSelect: "string_value",
  },
  {
    uiTableName: "Metadata",
    uiTableId: "metadata",
    datastoreTableName: "scores",
    datastoreSelect: "metadata",
  },
  {
    uiTableName: "Trace Name",
    uiTableId: "traceName",
    datastoreTableName: "traces",
    datastoreSelect: "t.name",
  },
  {
    uiTableName: "User ID",
    uiTableId: "userId",
    datastoreTableName: "traces",
    datastoreSelect: "t.user_id",
  },
  {
    uiTableName: "Trace Tags",
    uiTableId: "trace_tags",
    datastoreTableName: "traces",
    datastoreSelect: "t.tags",
  },
];

/**
 * v4 column definitions for scores table — trace columns reference events_core
 * instead of traces table. Used with the events_core subquery JOIN (alias e).
 */
export const scoresTableUiColumnDefinitionsFromEvents: UiColumnMappings = [
  // All scores-native columns are identical to v3
  ...scoresTableUiColumnDefinitions.filter(
    (c) => c.datastoreTableName === "scores",
  ),
  {
    uiTableName: "Trace Name",
    uiTableId: "traceName",
    datastoreTableName: "events_core",
    datastoreSelect: "trace_name",
  },
  {
    uiTableName: "User ID",
    uiTableId: "userId",
    datastoreTableName: "events_core",
    datastoreSelect: "user_id",
  },
  {
    uiTableName: "Trace Tags",
    uiTableId: "trace_tags",
    datastoreTableName: "events_core",
    datastoreSelect: "tags",
  },
];
