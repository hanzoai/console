import { useState } from "react";
import { DataTable } from "@/src/components/table/data-table";
import { type ConsoleColumnDef } from "@/src/components/table/types";
import { useVectorCollections, useDeleteCollection } from "@/src/features/vector/hooks";
import { CreateCollectionDialog } from "./CreateCollectionDialog";
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
import { MoreHorizontal, Trash2 } from "lucide-react";
import { type VectorCollection } from "@/src/features/vector/types";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

type CollectionRow = {
  name: string;
  vectorCount: number;
  dimension: number;
  distanceMetric: string;
  storageBytes: number;
  createdAt: string;
};

export function CollectionsTable({ projectId }: { projectId: string }) {
  const collectionsQuery = useVectorCollections(projectId);
  const deleteCollection = useDeleteCollection();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const collections: CollectionRow[] =
    (collectionsQuery.data as { collections?: VectorCollection[] })?.collections?.map((c) => ({
      name: c.name,
      vectorCount: c.vectorCount,
      dimension: c.dimension,
      distanceMetric: c.distanceMetric,
      storageBytes: c.storageBytes ?? 0,
      createdAt: c.createdAt,
    })) ?? [];

  const columns: ConsoleColumnDef<CollectionRow>[] = [
    {
      accessorKey: "name",
      id: "name",
      header: "Collection",
      size: 200,
    },
    {
      accessorKey: "vectorCount",
      id: "vectorCount",
      header: "Vectors",
      size: 120,
      cell: ({ row }) => row.original.vectorCount.toLocaleString(),
    },
    {
      accessorKey: "dimension",
      id: "dimension",
      header: "Dimension",
      size: 100,
    },
    {
      accessorKey: "distanceMetric",
      id: "distanceMetric",
      header: "Distance Metric",
      size: 140,
      cell: ({ row }) => {
        const metric = row.original.distanceMetric;
        const labels: Record<string, string> = {
          cosine: "Cosine",
          euclidean: "Euclidean",
          dotProduct: "Dot Product",
        };
        return labels[metric] ?? metric;
      },
    },
    {
      accessorKey: "storageBytes",
      id: "storageBytes",
      header: "Storage",
      size: 100,
      cell: ({ row }) => formatBytes(row.original.storageBytes),
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
        const collection = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(collection.name)}>
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
        <h3 className="text-lg font-semibold">Collections</h3>
        <CreateCollectionDialog projectId={projectId} />
      </div>

      <DataTable
        tableName="vectorCollections"
        columns={columns}
        data={
          collectionsQuery.isPending
            ? { isLoading: true, isError: false }
            : collectionsQuery.isError
              ? {
                  isLoading: false,
                  isError: true,
                  error: collectionsQuery.error.message,
                }
              : {
                  isLoading: false,
                  isError: false,
                  data: collections,
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
            <AlertDialogTitle>Delete collection?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget}</strong>? All vectors will be permanently removed.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                deleteCollection.mutate({ projectId, name: deleteTarget }, { onSuccess: () => setDeleteTarget(null) });
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
