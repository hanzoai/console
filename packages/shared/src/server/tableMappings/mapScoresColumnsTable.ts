import { UiColumnMappings } from "../../tableDefinitions";

export const scoresColumnsTableUiColumnDefinitions: UiColumnMappings = [
  // scores native columns
  {
    uiTableName: "Timestamp",
    uiTableId: "timestamp",
    datastoreTableName: "scores",
    datastoreSelect: "timestamp",
  },
  {
    uiTableName: "Session ID",
    uiTableId: "sessionId",
    datastoreTableName: "scores",
    datastoreSelect: 's."session_id"',
  },
  {
    uiTableName: "Dataset Run IDs",
    uiTableId: "datasetRunIds",
    datastoreTableName: "scores",
    datastoreSelect: 's."dataset_run_id"',
  },
  {
    uiTableName: "Observation ID",
    uiTableId: "observationId",
    datastoreTableName: "scores",
    datastoreSelect: 's."observation_id"',
  },
  {
    uiTableName: "Trace ID",
    uiTableId: "traceId",
    datastoreTableName: "scores",
    datastoreSelect: 's."trace_id"',
  },
  // require join of scores with dataset_run_items_rmt via trace_id and project_id
  {
    uiTableName: "Dataset Run Item Run IDs",
    uiTableId: "datasetRunItemRunIds",
    datastoreTableName: "dataset_run_items_rmt",
    datastoreSelect: 'dri."dataset_run_id"',
  },
  {
    uiTableName: "Dataset ID",
    uiTableId: "datasetId",
    datastoreTableName: "dataset_run_items_rmt",
    datastoreSelect: 'dri."dataset_id"',
  },
  {
    uiTableName: "Dataset Item IDs",
    uiTableId: "datasetItemIds",
    datastoreTableName: "dataset_run_items_rmt",
    datastoreSelect: 'dri."dataset_item_id"',
  },
];
