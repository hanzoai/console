import { useState } from "react";
import { DataTable } from "@/src/components/table/data-table";
import { type ConsoleColumnDef } from "@/src/components/table/types";
import { useZtRouters, useDeleteZtRouter } from "@/src/features/zt/hooks";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { CreateRouterDialog } from "./CreateRouterDialog";
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
import { Badge } from "@/src/components/ui/badge";
import { Check, X, MoreHorizontal, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";

type RouterRow = {
  id: string;
  name: string;
  isOnline: boolean;
  isVerified: boolean;
  isTunnelerEnabled: boolean;
  cost: number;
  roleAttributes: string[];
  createdAt: string;
};

export function ZtRoutersTable({ projectId }: { projectId: string }) {
  const routersQuery = useZtRouters(projectId);
  const deleteRouter = useDeleteZtRouter();

  const hasCUD = useHasProjectAccess({
    projectId,
    scope: "zt:CUD",
  });

  const [deleteTarget, setDeleteTarget] = useState<RouterRow | null>(null);

  const rows: RouterRow[] =
    (routersQuery.data as { data?: RouterRow[] })?.data?.map((r) => ({
      id: r.id,
      name: r.name,
      isOnline: r.isOnline,
      isVerified: r.isVerified,
      isTunnelerEnabled: r.isTunnelerEnabled,
      cost: r.cost,
      roleAttributes: r.roleAttributes ?? [],
      createdAt: r.createdAt,
    })) ?? [];

  const columns: ConsoleColumnDef<RouterRow>[] = [
    {
      accessorKey: "name",
      id: "name",
      header: "Name",
      size: 200,
      cell: ({ row }) => {
        const router = row.original;
        return (
          <Link
            href={`/project/${projectId}/zt/routers/${router.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {router.name}
          </Link>
        );
      },
    },
    {
      accessorKey: "isOnline",
      id: "isOnline",
      header: "Online",
      size: 80,
      cell: ({ row }) => {
        const online = row.original.isOnline;
        return (
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${online ? "bg-green-500" : "bg-gray-400"}`} />
            <span className="text-xs text-muted-foreground">{online ? "Yes" : "No"}</span>
          </span>
        );
      },
    },
    {
      accessorKey: "isVerified",
      id: "isVerified",
      header: "Verified",
      size: 80,
      cell: ({ row }) => {
        const verified = row.original.isVerified;
        return verified ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground" />
        );
      },
    },
    {
      accessorKey: "isTunnelerEnabled",
      id: "isTunnelerEnabled",
      header: "Tunneler",
      size: 100,
      cell: ({ row }) => {
        const enabled = row.original.isTunnelerEnabled;
        return <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Enabled" : "Disabled"}</Badge>;
      },
    },
    {
      accessorKey: "cost",
      id: "cost",
      header: "Cost",
      size: 80,
    },
    {
      accessorKey: "roleAttributes",
      id: "roleAttributes",
      header: "Role Attributes",
      size: 200,
      cell: ({ row }) => {
        const attrs = row.original.roleAttributes;
        if (!attrs.length) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {attrs.map((attr) => (
              <Badge key={attr} variant="outline" className="text-xs">
                {attr}
              </Badge>
            ))}
          </div>
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
      enableHiding: false,
      cell: ({ row }) => {
        const router = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/project/${projectId}/zt/routers/${router.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View
                </Link>
              </DropdownMenuItem>
              {hasCUD && (
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(router)}>
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
      <div className="flex items-center justify-end">{hasCUD && <CreateRouterDialog projectId={projectId} />}</div>

      <DataTable
        tableName="ztRouters"
        columns={columns}
        data={
          routersQuery.isPending
            ? { isLoading: true, isError: false }
            : routersQuery.isError
              ? {
                  isLoading: false,
                  isError: true,
                  error: routersQuery.error.message,
                }
              : {
                  isLoading: false,
                  isError: false,
                  data: rows,
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
            <AlertDialogTitle>Delete router?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                deleteRouter.mutate({ projectId, id: deleteTarget.id }, { onSuccess: () => setDeleteTarget(null) });
              }}
            >
              {deleteRouter.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
