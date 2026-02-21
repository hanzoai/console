import { DataTable } from "@/src/components/table/data-table";
import { type HanzoColumnDef } from "@/src/components/table/types";
import { useZtConfigs } from "@/src/features/zt/hooks";

type ConfigRow = {
  id: string;
  name: string;
  configTypeName: string;
  createdAt: string;
};

export function ZtConfigsTable({ projectId }: { projectId: string }) {
  const query = useZtConfigs(projectId);

  const configs: ConfigRow[] =
    (query.data?.data ?? []).map((item: any) => ({
      id: item.id,
      name: item.name,
      configTypeName: item.configType?.name ?? item.configTypeId,
      createdAt: item.createdAt,
    }));

  const columns: HanzoColumnDef<ConfigRow>[] = [
    {
      accessorKey: "name",
      id: "name",
      header: "Name",
      size: 250,
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "configTypeName",
      id: "configTypeName",
      header: "Config Type",
      size: 200,
      cell: ({ row }) => (
        <code className="text-xs">{row.original.configTypeName}</code>
      ),
    },
    {
      accessorKey: "createdAt",
      id: "createdAt",
      header: "Created",
      size: 150,
      cell: ({ row }) =>
        row.original.createdAt
          ? new Date(row.original.createdAt).toLocaleString()
          : "-",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        tableName="ztConfigs"
        columns={columns}
        data={
          query.isPending
            ? { isLoading: true, isError: false }
            : query.isError
              ? {
                  isLoading: false,
                  isError: true,
                  error: query.error.message,
                }
              : {
                  isLoading: false,
                  isError: false,
                  data: configs,
                }
        }
      />
    </div>
  );
}
