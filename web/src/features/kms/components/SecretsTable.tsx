import { useState } from "react";
import { DataTable } from "@/src/components/table/data-table";
import { type HanzoColumnDef } from "@/src/components/table/types";
import { useKmsSecrets, useKmsEnvironments, useDeleteSecret } from "@/src/features/kms/hooks";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { CreateSecretDialog } from "./CreateSecretDialog";
import { EditSecretDialog } from "./EditSecretDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
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
import { Copy, Eye, EyeOff, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { type KmsSecret } from "@/src/features/kms/types";

type SecretRow = {
  secretKey: string;
  secretValue: string;
  secretComment?: string;
  updatedAt: string;
};

export function SecretsTable({ projectId }: { projectId: string }) {
  const [environment, setEnvironment] = useState("dev");
  const secretPath = "/";

  const envQuery = useKmsEnvironments(projectId);
  const secretsQuery = useKmsSecrets(projectId, environment, secretPath);
  const deleteSecret = useDeleteSecret();

  const hasCUD = useHasProjectAccess({
    projectId,
    scope: "kmsSecrets:CUD",
  });

  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [editSecret, setEditSecret] = useState<SecretRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const secrets: SecretRow[] =
    (secretsQuery.data as { secrets?: KmsSecret[] })?.secrets?.map((s) => ({
      secretKey: s.secretKey,
      secretValue: s.secretValue,
      secretComment: s.secretComment,
      updatedAt: s.updatedAt,
    })) ?? [];

  const columns: HanzoColumnDef<SecretRow>[] = [
    {
      accessorKey: "secretKey",
      id: "secretKey",
      header: "Key",
      size: 200,
    },
    {
      accessorKey: "secretValue",
      id: "secretValue",
      header: "Value",
      size: 300,
      cell: ({ row }) => {
        const key = row.original.secretKey;
        const value = row.original.secretValue;
        const revealed = revealedKeys.has(key);
        return (
          <div className="flex items-center gap-2">
            <code className="text-xs">
              {revealed ? value : "\u2022".repeat(Math.min(value.length, 20))}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => toggleReveal(key)}
            >
              {revealed ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </Button>
          </div>
        );
      },
    },
    {
      accessorKey: "secretComment",
      id: "secretComment",
      header: "Comment",
      size: 200,
    },
    {
      accessorKey: "updatedAt",
      id: "updatedAt",
      header: "Updated",
      size: 150,
      cell: ({ row }) => {
        const d = row.original.updatedAt;
        return d ? new Date(d).toLocaleString() : "-";
      },
    },
    {
      accessorKey: "actions",
      id: "actions",
      header: "",
      size: 50,
      cell: ({ row }) => {
        const secret = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  void navigator.clipboard.writeText(secret.secretValue);
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy value
              </DropdownMenuItem>
              {hasCUD && (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      setEditSecret(secret);
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteTarget(secret.secretKey)}
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

  const environments =
    (envQuery.data as { environments?: { slug: string; name: string }[] })
      ?.environments ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Environment:</label>
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {environments.length > 0 ? (
                environments.map((e) => (
                  <SelectItem key={e.slug} value={e.slug}>
                    {e.name}
                  </SelectItem>
                ))
              ) : (
                <>
                  <SelectItem value="dev">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="prod">Production</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        {hasCUD && (
          <CreateSecretDialog
            projectId={projectId}
            environment={environment}
            secretPath={secretPath}
          />
        )}
      </div>

      <DataTable
        tableName="kmsSecrets"
        columns={columns}
        data={
          secretsQuery.isPending
            ? { isLoading: true, isError: false }
            : secretsQuery.isError
              ? {
                  isLoading: false,
                  isError: true,
                  error: secretsQuery.error.message,
                }
              : {
                  isLoading: false,
                  isError: false,
                  data: secrets,
                }
        }
      />

      <EditSecretDialog
        projectId={projectId}
        environment={environment}
        secretPath={secretPath}
        secret={editSecret}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete secret?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                deleteSecret.mutate(
                  {
                    projectId,
                    environment,
                    secretPath,
                    secretName: deleteTarget,
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
