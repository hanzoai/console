import { UiColumnMappings } from "./types";

export const datasetRunsTableUiColumnDefinitions: UiColumnMappings = [
  {
    uiTableName: "Dataset Run ID",
    uiTableId: "id",
    datastoreTableName: "dataset_run_items_rmt",
    datastoreSelect: "drm.dataset_run_id",
  },
  {
    uiTableName: "Created At",
    uiTableId: "createdAt",
    datastoreTableName: "dataset_run_items_rmt",
    datastoreSelect: "drm.dataset_run_created_at",
  },
  {
    uiTableName: "Scores (numeric)",
    uiTableId: "agg_scores_avg",
    datastoreTableName: "dataset_run_items_rmt",
    datastoreSelect: "sa.scores_avg",
  },
  {
    uiTableName: "Scores (categorical)",
    uiTableId: "agg_score_categories",
    datastoreTableName: "dataset_run_items_rmt",
    datastoreSelect: "sa.score_categories",
  },
];
