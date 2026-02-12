import { useState } from "react";
import { DataTable } from "@/src/components/table/data-table";
import { type HanzoColumnDef } from "@/src/components/table/types";
import { useKmsKeys, useUpdateKey, useDeleteKey } from "@/src/features/kms/hooks";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { CreateKeyDialog } from "./CreateKeyDialog";
import { EncryptDecryptDialog } from "./EncryptDecryptDialog";
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
import { KeyRound, MoreHorizontal, Power, PowerOff, Trash2 } from "lucide-react";
import { type KmsKey } from "@/src/features/kms/types";

type KeyRow = {
  id: string;
  name: string;
  description?: string;
  encryptionAlgorithm: string;
  keyUsage: string;
  isDisabled: boolean;
  createdAt: string;
};

export function EncryptionKeysTable({ projectId }: { projectId: string }) {
  const keysQuery = useKmsKeys(projectId);
  const updateKey = useUpdateKey();
  const deleteKey = useDeleteKey();

  const hasCUD = useHasProjectAccess({
    projectId,
    scope: "kmsKeys:CUD",
  });

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [encryptKey, setEncryptKey] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const keys: KeyRow[] =
    (keysQuery.data as { keys?: KmsKey[] })?.keys?.map((k) => ({
      id: k.id,
      name: k.name,
      description: k.description,
      encryptionAlgorithm: k.encryptionAlgorithm,
      keyUsage: k.keyUsage,
      isDisabled: k.isDisabled,
      createdAt: k.createdAt,
    })) ?? [];

  const columns: HanzoColumnDef<KeyRow>[] = [
    {
      accessorKey: "name",
      id: "name",
      header: "Name",
      size: 200,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.description && (
            <div className="text-xs text-muted-foreground">
              {row.original.description}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "encryptionAlgorithm",
      id: "encryptionAlgorithm",
      header: "Algorithm",
      size: 130,
      cell: ({ row }) => (
        <code className="text-xs">{row.original.encryptionAlgorithm}</code>
      ),
    },
    {
      accessorKey: "keyUsage",
      id: "keyUsage",
      header: "Usage",
      size: 130,
    },
    {
      accessorKey: "isDisabled",
      id: "status",
      header: "Status",
      size: 100,
      cell: ({ row }) =>
        row.original.isDisabled ? (
          <StatusBadge type="disabled" />
        ) : (
          <StatusBadge type="active" />
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
        const key = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  setEncryptKey({ id: key.id, name: key.name })
                }
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Encrypt / Decrypt
              </DropdownMenuItem>
              {hasCUD && (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      updateKey.mutate({
                        projectId,
                        keyId: key.id,
                        isDisabled: !key.isDisabled,
                      });
                    }}
                  >
                    {key.isDisabled ? (
                      <>
                        <Power className="mr-2 h-4 w-4" />
                        Enable
                      </>
                    ) : (
                      <>
                        <PowerOff className="mr-2 h-4 w-4" />
                        Disable
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() =>
                      setDeleteTarget({ id: key.id, name: key.name })
                    }
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        {hasCUD && <CreateKeyDialog projectId={projectId} />}
      </div>

      <DataTable
        tableName="kmsKeys"
        columns={columns}
        data={
          keysQuery.isPending
            ? { isLoading: true, isError: false }
            : keysQuery.isError
              ? {
                  isLoading: false,
                  isError: true,
                  error: keysQuery.error.message,
                }
              : {
                  isLoading: false,
                  isError: false,
                  data: keys,
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
            <AlertDialogTitle>Delete encryption key?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete key{" "}
              <strong>{deleteTarget?.name}</strong>? This action cannot be undone
              and any data encrypted with this key will become unrecoverable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                deleteKey.mutate(
                  { projectId, keyId: deleteTarget.id },
                  { onSuccess: () => setDeleteTarget(null) },
                );
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {encryptKey && (
        <EncryptDecryptDialog
          projectId={projectId}
          keyId={encryptKey.id}
          keyName={encryptKey.name}
          open={!!encryptKey}
          onOpenChange={(open) => {
            if (!open) setEncryptKey(null);
          }}
        />
      )}
    </div>
  );
}
