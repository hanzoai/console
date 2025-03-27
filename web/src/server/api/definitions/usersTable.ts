import { type ColumnDefinition } from "@hanzo/shared";

export const usersTableCols: ColumnDefinition[] = [
  {
    name: "Timestamp",
    id: "timestamp",
    type: "datetime",
    internal: 't."timestamp"',
  },
];
