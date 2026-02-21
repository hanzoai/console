import { useState } from "react";
import { DataTable, type AsyncTableData } from "@/src/components/table/data-table";
import { type HanzoColumnDef } from "@/src/components/table/types";
import { useZtServices, useDeleteZtService } from "@/src/features/zt/hooks";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { Lock, Unlock, MoreVertical, Trash } from "lucide-react";
import { CreateServiceDialog } from "@/src/features/zt/components/CreateServiceDialog";

type ServiceRow = {
  id: string;
  name: string;
  encryptionRequired: boolean;
  roleAttributes: string[];
  createdAt: string;
};

export function ZtServicesTable({ projectId }: { projectId: string }) {
  const query = useZtServices(projectId);
  const deleteMut = useDeleteZtService();
  const hasCud = useHasProjectAccess({ projectId, scope: "zt:CUD" });

  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null);

  const services: ServiceRow[] = ((query.data?.data ?? []) as Record<string, unknown>[]).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    encryptionRequired: (s.encryptionRequired as boolean) ?? true,
    roleAttributes: (s.roleAttributes as string[]) ?? [],
    createdAt: s.createdAt as string,
  }));

  const columns: HanzoColumnDef<ServiceRow>[] = [
    {
      accessorKey: "name",
      id: "name",
      header: "Name",
    },
    {
      accessorKey: "encryptionRequired",
      id: "encryptionRequired",
      header: "Encryption",
      cell: ({ row }) => {
        const encrypted = row.getValue("encryptionRequired") as boolean;
        return encrypted ? (
          <Lock className="h-4 w-4 text-green-600" />
        ) : (
          <Unlock className="h-4 w-4 text-muted-foreground" />
        );
      },
    },
    {
      accessorKey: "roleAttributes",
      id: "roleAttributes",
      header: "Role Attributes",
      cell: ({ row }) => {
        const attrs = row.getValue("roleAttributes") as string[];
        if (attrs.length === 0) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {attrs.map((attr) => (
              <span
                key={attr}
                className="rounded bg-muted px-1.5 py-0.5 text-xs"
              >
                {attr}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      id: "createdAt",
      header: "Created",
      cell: ({ row }) => {
        const value = row.getValue("createdAt") as string;
        return value ? new Date(value).toLocaleString() : "-";
      },
    },
    {
      accessorKey: "id",
      id: "actions",
      header: "Actions",
      enableHiding: false,
      cell: ({ row }) => {
        const service = row.original;
        if (!hasCud) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteTarget(service)}
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const tableData: AsyncTableData<ServiceRow[]> = query.isPending
    ? { isLoading: true, isError: false }
    : query.isError
      ? { isLoading: false, isError: true, error: query.error.message }
      : { isLoading: false, isError: false, data: services };

  return (
    <div className="flex flex-col gap-2">
      {hasCud && (
        <div className="flex justify-end">
          <CreateServiceDialog projectId={projectId} />
        </div>
      )}

      <DataTable
        tableName="ztServices"
        columns={columns}
        data={tableData}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the service &quot;{deleteTarget?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteMut.mutate({ projectId, id: deleteTarget.id });
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
