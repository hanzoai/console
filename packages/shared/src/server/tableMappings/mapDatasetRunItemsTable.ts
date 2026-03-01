import { UiColumnMappings } from "../../tableDefinitions";
import { DatasetRunItemDomain } from "../../domain/dataset-run-items";

export const datasetRunItemsTableUiColumnDefinitions: UiColumnMappings = [
  {
    uiTableName: "Dataset Run ID",
    uiTableId: "datasetRunId",
    datastoreTableName: "dataset_run_items_rmt",
    datastoreSelect: 'dri."dataset_run_id"',
  },
  {
    uiTableName: "Created At",
    uiTableId: "createdAt",
    datastoreTableName: "dataset_run_items_rmt",
    datastoreSelect: 'dri."created_at"',
  },
  {
    uiTableName: "Event Timestamp",
    uiTableId: "eventTs",
    datastoreTableName: "dataset_run_items_rmt",
    datastoreSelect: 'dri."event_ts"',
  },
  {
    uiTableName: "Dataset Item ID",
    uiTableId: "datasetItemId",
    datastoreTableName: "dataset_run_items_rmt",
    datastoreSelect: 'dri."dataset_item_id"',
  },
  {
    uiTableName: "Dataset",
    uiTableId: "datasetId",
    datastoreTableName: "dataset_run_items_rmt",
    datastoreSelect: 'dri."dataset_id"',
  },
  {
    uiTableName: "Scores (numeric)",
    uiTableId: "agg_scores_avg",
    datastoreTableName: "scores",
    datastoreSelect: "sa.scores_avg",
  },
  {
    uiTableName: "Scores (categorical)",
    uiTableId: "agg_score_categories",
    datastoreTableName: "scores",
    datastoreSelect: "sa.score_categories",
  },
];

export const mapDatasetRunItemFilterColumn = (
  dataset: Pick<DatasetRunItemDomain, "id" | "datasetId">,
  column: string,
): unknown => {
  const columnDef = datasetRunItemsTableUiColumnDefinitions.find(
    (col) => col.uiTableId === column || col.uiTableName === column || col.datastoreSelect === column,
  );
  if (!columnDef) {
    throw new Error(`Unhandled column for dataset run items filter: ${column}`);
  }
  switch (columnDef.uiTableId) {
    case "id":
      return dataset.id;
    case "datasetId":
      return dataset.datasetId;
    default:
      throw new Error(`Unhandled column in dataset run items filter mapping: ${column}`);
  }
};
