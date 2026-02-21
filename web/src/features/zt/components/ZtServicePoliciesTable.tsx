import { useState } from "react";
import { DataTable } from "@/src/components/table/data-table";
import { type HanzoColumnDef } from "@/src/components/table/types";
import {
  useZtServicePolicies,
  useDeleteZtServicePolicy,
} from "@/src/features/zt/hooks";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { CreateServicePolicyDialog } from "./CreateServicePolicyDialog";
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
import { StatusBadge } from "@/src/components/layouts/status-badge";
import { MoreHorizontal, Trash2 } from "lucide-react";

type ServicePolicyRow = {
  id: string;
  name: string;
  type: string;
  semantic: string;
  identityRoles: string[];
  serviceRoles: string[];
  createdAt: string;
};

export function ZtServicePoliciesTable({
  projectId,
}: {
  projectId: string;
}) {
  const query = useZtServicePolicies(projectId);
  const deletePolicy = useDeleteZtServicePolicy();

  const hasCUD = useHasProjectAccess({
    projectId,
    scope: "zt:CUD",
  });

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const policies: ServicePolicyRow[] =
    (query.data?.data ?? []).map((item: any) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      semantic: item.semantic,
      identityRoles: item.identityRoles ?? [],
      serviceRoles: item.serviceRoles ?? [],
      createdAt: item.createdAt,
    }));

  const columns: HanzoColumnDef<ServicePolicyRow>[] = [
    {
      accessorKey: "name",
      id: "name",
      header: "Name",
      size: 200,
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "type",
      id: "type",
      header: "Type",
      size: 100,
      cell: ({ row }) => {
        const t = row.original.type;
        return (
          <StatusBadge
            type={t === "Bind" ? "active" : "pending"}
            isLive={false}
            showText={false}
          >
            {t}
          </StatusBadge>
        );
      },
    },
    {
      accessorKey: "semantic",
      id: "semantic",
      header: "Semantic",
      size: 100,
      cell: ({ row }) => (
        <code className="text-xs">{row.original.semantic}</code>
      ),
    },
    {
      accessorKey: "identityRoles",
      id: "identityRoles",
      header: "Identity Roles",
      size: 120,
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.identityRoles.length} role
          {row.original.identityRoles.length !== 1 ? "s" : ""}
        </span>
      ),
    },
    {
      accessorKey: "serviceRoles",
      id: "serviceRoles",
      header: "Service Roles",
      size: 120,
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.serviceRoles.length} role
          {row.original.serviceRoles.length !== 1 ? "s" : ""}
        </span>
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
    {
      accessorKey: "actions",
      id: "actions",
      header: "",
      size: 50,
      cell: ({ row }) => {
        const policy = row.original;
        if (!hasCUD) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={() =>
                  setDeleteTarget({ id: policy.id, name: policy.name })
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        {hasCUD && <CreateServicePolicyDialog projectId={projectId} />}
      </div>

      <DataTable
        tableName="ztServicePolicies"
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
                  data: policies,
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
            <AlertDialogTitle>Delete service policy?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget?.name}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                deletePolicy.mutate(
                  { projectId, id: deleteTarget.id },
                  { onSuccess: () => setDeleteTarget(null) },
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
