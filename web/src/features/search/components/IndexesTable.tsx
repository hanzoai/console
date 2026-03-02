import { useState } from "react";
import { DataTable } from "@/src/components/table/data-table";
import { type ConsoleColumnDef } from "@/src/components/table/types";
import { useSearchIndexes, useDeleteIndex, useReindex } from "@/src/features/search/hooks";
import { CreateIndexDialog } from "./CreateIndexDialog";
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
import { MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { type SearchIndex } from "@/src/features/search/types";

type IndexRow = {
  name: string;
  docCount: number;
  lastIndexedAt: string | null;
  createdAt: string;
};

export function IndexesTable({ projectId }: { projectId: string }) {
  const indexesQuery = useSearchIndexes(projectId);
  const deleteIndex = useDeleteIndex();
  const reindex = useReindex();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const indexes: IndexRow[] =
    (indexesQuery.data as { indexes?: SearchIndex[] })?.indexes?.map((idx) => ({
      name: idx.name,
      docCount: idx.docCount,
      lastIndexedAt: idx.lastIndexedAt,
      createdAt: idx.createdAt,
    })) ?? [];

  const columns: ConsoleColumnDef<IndexRow>[] = [
    {
      accessorKey: "name",
      id: "name",
      header: "Store Name",
      size: 200,
    },
    {
      accessorKey: "docCount",
      id: "docCount",
      header: "Documents",
      size: 120,
      cell: ({ row }) => row.original.docCount.toLocaleString(),
    },
    {
      accessorKey: "lastIndexedAt",
      id: "lastIndexedAt",
      header: "Last Indexed",
      size: 180,
      cell: ({ row }) => {
        const d = row.original.lastIndexedAt;
        return d ? new Date(d).toLocaleString() : "Never";
      },
    },
    {
      accessorKey: "createdAt",
      id: "createdAt",
      header: "Created",
      size: 180,
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    {
      accessorKey: "actions",
      id: "actions",
      header: "",
      size: 50,
      cell: ({ row }) => {
        const index = row.original;
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
                  reindex.mutate({ projectId, storeName: index.name });
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reindex
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(index.name)}>
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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Search Indexes</h3>
        <CreateIndexDialog projectId={projectId} />
      </div>

      <DataTable
        tableName="searchIndexes"
        columns={columns}
        data={
          indexesQuery.isPending
            ? { isLoading: true, isError: false }
            : indexesQuery.isError
              ? {
                  isLoading: false,
                  isError: true,
                  error: indexesQuery.error.message,
                }
              : {
                  isLoading: false,
                  isError: false,
                  data: indexes,
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
            <AlertDialogTitle>Delete index?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget}</strong>? All indexed documents will be removed.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                deleteIndex.mutate({ projectId, storeName: deleteTarget }, { onSuccess: () => setDeleteTarget(null) });
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
