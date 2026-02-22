import { useState } from "react";
import Link from "next/link";
import { DataTable } from "@/src/components/table/data-table";
import { type ConsoleColumnDef } from "@/src/components/table/types";
import { useZtIdentities, useDeleteZtIdentity } from "@/src/features/zt/hooks";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { CreateIdentityDialog } from "./CreateIdentityDialog";
import { type ZtIdentity } from "@/src/features/zt/types";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
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
import { Eye, MoreHorizontal, Trash2 } from "lucide-react";

type IdentityRow = {
  id: string;
  name: string;
  typeName: string;
  isOnline: boolean;
  isAdmin: boolean;
  roleAttributes: string[];
  createdAt: string;
};

export function ZtIdentitiesTable({ projectId }: { projectId: string }) {
  const query = useZtIdentities(projectId);
  const deleteIdentity = useDeleteZtIdentity();

  const hasCUD = useHasProjectAccess({
    projectId,
    scope: "zt:CUD",
  });

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const identities: IdentityRow[] = ((query.data as { data?: ZtIdentity[] })?.data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    typeName: i.type.name,
    isOnline: i.isOnline,
    isAdmin: i.isAdmin,
    roleAttributes: i.roleAttributes ?? [],
    createdAt: i.createdAt,
  }));

  const columns: ConsoleColumnDef<IdentityRow>[] = [
    {
      accessorKey: "name",
      id: "name",
      header: "Name",
      size: 200,
    },
    {
      accessorKey: "typeName",
      id: "typeName",
      header: "Type",
      size: 100,
    },
    {
      accessorKey: "isOnline",
      id: "isOnline",
      header: "Online",
      size: 80,
      cell: ({ row }) => {
        const online = row.original.isOnline;
        return (
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${online ? "bg-green-500" : "bg-gray-400"}`}
            title={online ? "Online" : "Offline"}
          />
        );
      },
    },
    {
      accessorKey: "isAdmin",
      id: "isAdmin",
      header: "Admin",
      size: 80,
      cell: ({ row }) => {
        return row.original.isAdmin ? <Badge variant="secondary">Admin</Badge> : null;
      },
    },
    {
      accessorKey: "roleAttributes",
      id: "roleAttributes",
      header: "Role Attributes",
      size: 200,
      cell: ({ row }) => {
        const attrs = row.original.roleAttributes;
        return attrs.length > 0 ? (
          <span className="text-xs text-muted-foreground">{attrs.join(", ")}</span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      id: "createdAt",
      header: "Created",
      size: 150,
      cell: ({ row }) => {
        const d = row.original.createdAt;
        return d ? new Date(d).toLocaleString() : "-";
      },
    },
    {
      accessorKey: "actions",
      id: "actions",
      header: "",
      size: 50,
      cell: ({ row }) => {
        const identity = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/project/${projectId}/zt/identities/${identity.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </Link>
              </DropdownMenuItem>
              {hasCUD && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() =>
                    setDeleteTarget({
                      id: identity.id,
                      name: identity.name,
                    })
                  }
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div />
        {hasCUD && <CreateIdentityDialog projectId={projectId} />}
      </div>

      <DataTable
        tableName="ztIdentities"
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
                  data: identities,
                }
        }
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete identity?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                deleteIdentity.mutate(
                  {
                    projectId,
                    id: deleteTarget.id,
                  },
                  {
                    onSuccess: () => setDeleteTarget(null),
                  },
                );
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
