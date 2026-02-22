import { DataTable } from "@/src/components/table/data-table";
import { type ConsoleColumnDef } from "@/src/components/table/types";
import { useZtTerminators } from "@/src/features/zt/hooks";

type TerminatorRow = {
  id: string;
  serviceName: string;
  routerName: string;
  binding: string;
  address: string;
  cost: number;
  precedence: string;
  createdAt: string;
};

export function ZtTerminatorsTable({ projectId }: { projectId: string }) {
  const query = useZtTerminators(projectId);

  const terminators: TerminatorRow[] = (query.data?.data ?? []).map((item: any) => ({
    id: item.id,
    serviceName: item.service?.name ?? item.serviceId,
    routerName: item.router?.name ?? item.routerId,
    binding: item.binding,
    address: item.address,
    cost: item.cost,
    precedence: item.precedence,
    createdAt: item.createdAt,
  }));

  const columns: ConsoleColumnDef<TerminatorRow>[] = [
    {
      accessorKey: "serviceName",
      id: "serviceName",
      header: "Service",
      size: 180,
      cell: ({ row }) => <span className="font-medium">{row.original.serviceName}</span>,
    },
    {
      accessorKey: "routerName",
      id: "routerName",
      header: "Router",
      size: 180,
      cell: ({ row }) => <span className="font-medium">{row.original.routerName}</span>,
    },
    {
      accessorKey: "binding",
      id: "binding",
      header: "Binding",
      size: 120,
      cell: ({ row }) => <code className="text-xs">{row.original.binding}</code>,
    },
    {
      accessorKey: "address",
      id: "address",
      header: "Address",
      size: 200,
      cell: ({ row }) => <code className="text-xs">{row.original.address}</code>,
    },
    {
      accessorKey: "cost",
      id: "cost",
      header: "Cost",
      size: 80,
    },
    {
      accessorKey: "precedence",
      id: "precedence",
      header: "Precedence",
      size: 110,
      cell: ({ row }) => <code className="text-xs">{row.original.precedence}</code>,
    },
    {
      accessorKey: "createdAt",
      id: "createdAt",
      header: "Created",
      size: 150,
      cell: ({ row }) => (row.original.createdAt ? new Date(row.original.createdAt).toLocaleString() : "-"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        tableName="ztTerminators"
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
                  data: terminators,
                }
        }
      />
    </div>
  );
}
