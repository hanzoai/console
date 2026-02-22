import { DataTable } from "@/src/components/table/data-table";
import { type ConsoleColumnDef } from "@/src/components/table/types";
import { useZtSessions } from "@/src/features/zt/hooks";
import { StatusBadge } from "@/src/components/layouts/status-badge";

type SessionRow = {
  id: string;
  identityName: string;
  serviceName: string;
  type: string;
  createdAt: string;
};

export function ZtSessionsTable({ projectId }: { projectId: string }) {
  const query = useZtSessions(projectId);

  const sessions: SessionRow[] = (query.data?.data ?? []).map((item: any) => ({
    id: item.id,
    identityName: item.identity?.name ?? item.identityId,
    serviceName: item.service?.name ?? item.serviceId,
    type: item.type,
    createdAt: item.createdAt,
  }));

  const columns: ConsoleColumnDef<SessionRow>[] = [
    {
      accessorKey: "identityName",
      id: "identityName",
      header: "Identity",
      size: 200,
      cell: ({ row }) => <span className="font-medium">{row.original.identityName}</span>,
    },
    {
      accessorKey: "serviceName",
      id: "serviceName",
      header: "Service",
      size: 200,
      cell: ({ row }) => <span className="font-medium">{row.original.serviceName}</span>,
    },
    {
      accessorKey: "type",
      id: "type",
      header: "Type",
      size: 100,
      cell: ({ row }) => {
        const t = row.original.type;
        return (
          <StatusBadge type={t === "Bind" ? "active" : "pending"} isLive={false} showText={false}>
            {t}
          </StatusBadge>
        );
      },
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
        tableName="ztSessions"
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
                  data: sessions,
                }
        }
      />
    </div>
  );
}
