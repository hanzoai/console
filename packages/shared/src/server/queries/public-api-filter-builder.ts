import { filterOperators } from "../../interfaces/filters";
import {
  FilterList,
  DateTimeFilter,
  ArrayOptionsFilter,
  StringOptionsFilter,
  CategoryOptionsFilter,
  StringFilter,
  NumberFilter,
  type DatastoreOperator,
} from "./datastore-sql/datastore-filter";
import { z } from "zod/v4";
import type { FilterState } from "../../types";
import type { UiColumnMappings } from "../../tableDefinitions";
import { createFilterFromFilterState } from "./datastore-sql/factory";

export type ApiColumnMapping = {
  id: string;
  datastoreSelect: string;
  datastoreTable: string;
  filterType: string;
  operator?: DatastoreOperator;
  datastorePrefix?: string;
};

/**
 * Base column definition for traces table mappings
 * Single source of truth for all trace column mappings
 */
const TRACES_COLUMN_DEFINITIONS = [
  {
    id: "timestamp",
    name: "Timestamp",
    column: "timestamp",
    filterType: "DateTimeFilter",
  },
  {
    id: "userId",
    name: "User ID",
    column: "user_id",
    filterType: "StringFilter",
  },
  { id: "name", name: "Name", column: "name", filterType: "StringFilter" },
  {
    id: "environment",
    name: "Environment",
    column: "environment",
    filterType: "StringOptionsFilter",
  },
  {
    id: "metadata",
    name: "Metadata",
    column: "metadata",
    filterType: "StringObjectFilter",
  },
  {
    id: "sessionId",
    name: "Session ID",
    column: "session_id",
    filterType: "StringFilter",
  },
  {
    id: "version",
    name: "Version",
    column: "version",
    filterType: "StringFilter",
  },
  {
    id: "release",
    name: "Release",
    column: "release",
    filterType: "StringFilter",
  },
  {
    id: "tags",
    name: "Tags",
    column: "tags",
    filterType: "ArrayOptionsFilter",
  },
] as const;

/**
 * Convenience function: Get just the simple filter mappings for public API
 */
export function createPublicApiTracesColumnMapping(tableName: "traces", tablePrefix: "t"): ApiColumnMapping[] {
  const timestampColumn = "timestamp";
  const simpleFilters: ApiColumnMapping[] = [];
  for (const def of TRACES_COLUMN_DEFINITIONS) {
    // For timestamp filters, create fromTimestamp and toTimestamp
    if (def.id === "timestamp") {
      simpleFilters.push(
        {
          id: "fromTimestamp",
          datastoreSelect: timestampColumn,
          operator: ">=" as const,
          filterType: def.filterType,
          datastoreTable: tableName,
          datastorePrefix: tablePrefix,
        },
        {
          id: "toTimestamp",
          datastoreSelect: timestampColumn,
          operator: "<" as const,
          filterType: def.filterType,
          datastoreTable: tableName,
          datastorePrefix: tablePrefix,
        },
      );
    } else {
      // Regular column mapping for simple filters
      simpleFilters.push({
        id: def.id,
        datastoreSelect: def.column,
        filterType: def.filterType,
        datastoreTable: tableName,
        datastorePrefix: tablePrefix,
      });
    }
  }
  return simpleFilters;
}

/**
 * Factory function to create public API column mappings for events/observations tables.
 * Eliminates duplication between events and observations filter mappings.
 */
export function createPublicApiObservationsColumnMapping(
  tableName: "events_proto" | "observations",
  tablePrefix: "e" | "o",
  parentFieldName: "parent_span_id" | "parent_observation_id",
): ApiColumnMapping[] {
  return [
    {
      id: "userId",
      datastoreSelect: "user_id",
      filterType: "StringFilter",
      datastoreTable: "traces",
      datastorePrefix: "t",
    },
    {
      id: "traceId",
      datastoreSelect: "trace_id",
      filterType: "StringFilter",
      datastoreTable: tableName,
      datastorePrefix: tablePrefix,
    },
    {
      id: "name",
      datastoreSelect: "name",
      filterType: "StringFilter",
      datastoreTable: tableName,
      datastorePrefix: tablePrefix,
    },
    {
      id: "level",
      datastoreSelect: "level",
      filterType: "StringFilter",
      datastoreTable: tableName,
      datastorePrefix: tablePrefix,
    },
    {
      id: "type",
      datastoreSelect: "type",
      filterType: "StringFilter",
      datastoreTable: tableName,
      datastorePrefix: tablePrefix,
    },
    {
      id: "parentObservationId",
      datastoreSelect: parentFieldName,
      filterType: "StringFilter",
      datastoreTable: tableName,
      datastorePrefix: tablePrefix,
    },
    {
      id: "fromStartTime",
      datastoreSelect: "start_time",
      operator: ">=",
      filterType: "DateTimeFilter",
      datastoreTable: tableName,
      datastorePrefix: tablePrefix,
    },
    {
      id: "toStartTime",
      datastoreSelect: "start_time",
      operator: "<",
      filterType: "DateTimeFilter",
      datastoreTable: tableName,
      datastorePrefix: tablePrefix,
    },
    {
      id: "version",
      datastoreSelect: "version",
      filterType: "StringFilter",
      datastoreTable: tableName,
      datastorePrefix: tablePrefix,
    },
    {
      id: "environment",
      datastoreSelect: "environment",
      filterType: "StringFilter",
      datastoreTable: tableName,
      datastorePrefix: tablePrefix,
    },
  ];
}

type BaseQueryType = {
  page: number;
  limit: number;
  projectId: string;
} & Record<string, unknown>;

export function convertApiProvidedFilterToDatastoreFilter(filter: BaseQueryType, columnMapping: ApiColumnMapping[]) {
  const filterList = new FilterList();

  columnMapping.forEach((columnMapping) => {
    const value = filter[columnMapping.id as keyof BaseQueryType];

    if (value !== undefined) {
      let filterInstance;
      switch (columnMapping.filterType) {
        case "DateTimeFilter": {
          // get filter options from the filterOperators
          // validate that the user provided operator is in the list of available operators
          const availableOperators = z.enum(filterOperators.datetime);
          const parsedOperator = availableOperators.safeParse(filter.operator);

          // otherwise fall back to the operator provided in the column mapping
          const finalOperator = parsedOperator.success ? parsedOperator.data : columnMapping.operator;

          finalOperator && typeof value === "string" && ["<", "<=", ">", ">="].includes(finalOperator)
            ? (filterInstance = new DateTimeFilter({
                datastoreTable: columnMapping.datastoreTable,
                field: columnMapping.datastoreSelect,
                operator: finalOperator as "<" | "<=" | ">" | ">=",
                value: new Date(value),
                tablePrefix: columnMapping.datastorePrefix,
              }))
            : undefined;

          break;
        }
        case "ArrayOptionsFilter":
          if (Array.isArray(value) || typeof value === "string") {
            filterInstance = new ArrayOptionsFilter({
              datastoreTable: columnMapping.datastoreTable,
              field: columnMapping.datastoreSelect,
              operator: "all of",
              values: Array.isArray(value) ? value : value.split(","),
              tablePrefix: columnMapping.datastorePrefix,
            });
          }
          break;
        case "StringOptionsFilter":
          if (Array.isArray(value) || typeof value === "string") {
            filterInstance = new StringOptionsFilter({
              datastoreTable: columnMapping.datastoreTable,
              field: columnMapping.datastoreSelect,
              operator: "any of",
              values: Array.isArray(value) ? value : value.split(","),
              tablePrefix: columnMapping.datastorePrefix,
            });
          }
          break;
        case "CategoryOptionsFilter":
          if (Array.isArray(value)) {
            const availableOperatorsCategory = z.enum(filterOperators.categoryOptions);
            const parsedOperatorCategory = availableOperatorsCategory.safeParse(filter.operator);

            if (parsedOperatorCategory.success && typeof filter.key === "string") {
              filterInstance = new CategoryOptionsFilter({
                datastoreTable: columnMapping.datastoreTable,
                field: columnMapping.datastoreSelect,
                key: filter.key,
                operator: parsedOperatorCategory.data,
                values: value,
                tablePrefix: columnMapping.datastorePrefix,
              });
            }
          }
          break;

        case "StringFilter":
          if (typeof value === "string") {
            filterInstance = new StringFilter({
              datastoreTable: columnMapping.datastoreTable,
              field: columnMapping.datastoreSelect,
              operator: "=",
              value: value,
              tablePrefix: columnMapping.datastorePrefix,
            });
          }
          break;
        case "NumberFilter": {
          const availableOperatorsNum = z.enum([...filterOperators.number, "!="]);
          const parsedOperatorNum = availableOperatorsNum.safeParse(filter.operator);

          if (parsedOperatorNum.success) {
            filterInstance = new NumberFilter({
              datastoreTable: columnMapping.datastoreTable,
              field: columnMapping.datastoreSelect,
              operator: parsedOperatorNum.data,
              value: Number(value),
              tablePrefix: columnMapping.datastorePrefix,
            });
          }
          break;
        }
      }

      filterInstance && filterList.push(filterInstance);
    }
  });

  return filterList;
}

/**
 * Derives a merged FilterList from simple API parameters and advanced filter JSON.
 * Advanced filters take precedence over simple filters when targeting the same field.
 *
 * @param simpleFilterProps - Object containing simple query parameters (e.g., { userId: "123", name: "test" })
 * @param filterParamsMapping - Column mapping configuration for simple filters
 * @param advancedFilters - Optional array of FilterState objects from JSON filter parameter
 * @param uiColumnDefinitions - UI column definitions for advanced filter conversion
 * @returns Merged FilterList with advanced filters taking precedence
 */
export function deriveFilters<T extends BaseQueryType>(
  simpleFilterProps: T,
  filterParamsMapping: ApiColumnMapping[],
  advancedFilters: FilterState | undefined,
  uiColumnDefinitions: UiColumnMappings,
): FilterList {
  // Start with advanced filters converted to FilterList
  const filterList = new FilterList(createFilterFromFilterState(advancedFilters ?? [], uiColumnDefinitions));

  // Convert simple parameters to filters
  const simpleFilters = convertApiProvidedFilterToDatastoreFilter(simpleFilterProps, filterParamsMapping);

  // Advanced filter takes precedence. Remove all simple filters that are also in advanced filter
  const advancedFilterColumns = new Set<string>();
  filterList.forEach((f) => advancedFilterColumns.add(f.field));

  simpleFilters.filter((sf) => !advancedFilterColumns.has(sf.field)).forEach((f) => filterList.push(f));

  // Return merged filters
  return filterList;
}
