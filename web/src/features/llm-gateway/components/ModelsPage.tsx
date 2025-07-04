import { useState } from "react";
import { api } from "@/src/utils/api";
import { DataTable } from "@/src/components/table/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Button } from "@/src/components/ui/button";
import { MoreVertical, Plus, Settings, Trash, TestTube } from "lucide-react";
import { type RouterOutput } from "@/src/utils/types";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";
import { showErrorToast } from "@/src/features/notifications/showErrorToast";
import { CreateModelDialog } from "./CreateModelDialog";
import { TestModelDialog } from "./TestModelDialog";
import { type ColumnDef } from "@tanstack/react-table";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Badge } from "@/src/components/ui/badge";

type Model = RouterOutput["llmGateway"]["models"]["list"][number];

export function ModelsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [testingModel, setTestingModel] = useState<Model | null>(null);

  const { data: models, isLoading, refetch } = api.llmGateway.models.list.useQuery({
    includePublic: true,
  });

  const deleteModel = api.llmGateway.models.delete.useMutation({
    onSuccess: () => {
      showSuccessToast("Model deleted successfully");
      void refetch();
    },
    onError: (error) => {
      showErrorToast(error.message);
    },
  });

  const columns: ColumnDef<Model>[] = [
    {
      accessorKey: "model_name",
      header: "Model Name",
      cell: ({ row }) => {
        const model = row.original;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{model.model_name}</span>
            {model.model_info?.base_model && (
              <Badge variant="secondary" className="text-xs">
                {model.model_info.base_model}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "litellm_params.model",
      header: "Provider Model",
      cell: ({ row }) => {
        const params = row.original.litellm_params;
        return (
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            {params.model}
          </code>
        );
      },
    },
    {
      accessorKey: "litellm_params.custom_llm_provider",
      header: "Provider",
      cell: ({ row }) => {
        const provider = row.original.litellm_params.custom_llm_provider;
        if (!provider) return "-";
        return (
          <Badge variant="outline" className="capitalize">
            {provider}
          </Badge>
        );
      },
    },
    {
      accessorKey: "model_info",
      header: "Pricing",
      cell: ({ row }) => {
        const info = row.original.model_info;
        if (!info?.input_cost_per_token && !info?.output_cost_per_token) {
          return <span className="text-muted-foreground">-</span>;
        }
        return (
          <div className="text-xs">
            {info.input_cost_per_token && (
              <div>
                Input: ${(info.input_cost_per_token * 1000).toFixed(4)}/1K
              </div>
            )}
            {info.output_cost_per_token && (
              <div>
                Output: ${(info.output_cost_per_token * 1000).toFixed(4)}/1K
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => {
        const date = new Date(row.original.created_at);
        return date.toLocaleDateString();
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const model = row.original;
        const isSystemModel = !model.created_by; // System models don't have created_by

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTestingModel(model)}>
                <TestTube className="mr-2 h-4 w-4" />
                Test Model
              </DropdownMenuItem>
              {!isSystemModel && (
                <>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => deleteModel.mutate({ modelId: model.model_id })}
                  >
                    <Trash className="mr-2 h-4 w-4" />
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Models</h2>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Model
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={models || []}
        pagination={{
          pageSize: 20,
          pageIndex: 0,
        }}
      />

      <CreateModelDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          setShowCreateDialog(false);
          void refetch();
        }}
      />

      {testingModel && (
        <TestModelDialog
          model={testingModel}
          open={true}
          onOpenChange={(open) => {
            if (!open) setTestingModel(null);
          }}
        />
      )}
    </div>
  );
}