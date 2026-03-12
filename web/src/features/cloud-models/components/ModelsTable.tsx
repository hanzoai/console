import { useMemo, useState } from "react";
import { DataTable } from "@/src/components/table/data-table";
import { type ConsoleColumnDef } from "@/src/components/table/types";
import { Badge } from "@/src/components/ui/badge";
import { useCloudModels } from "../hooks";
import { providerLabels, type CloudModel, type ModelPricing } from "../types";
import { ProviderFilter } from "./ProviderFilter";

type ModelRow = {
  id: string;
  ownedBy: string;
  premium: boolean;
  created: number;
  pricing: ModelPricing | null;
};

function formatPrice(perMTok: number | undefined): string {
  if (perMTok == null) return "—";
  if (perMTok === 0) return "Free";
  if (perMTok < 0.01) return `$${perMTok.toFixed(4)}`;
  if (perMTok < 1) return `$${perMTok.toFixed(3)}`;
  return `$${perMTok.toFixed(2)}`;
}

export function ModelsTable({ projectId }: { projectId: string }) {
  const modelsQuery = useCloudModels(projectId);
  const [providerFilter, setProviderFilter] = useState<string | null>(null);

  const allModels: ModelRow[] = useMemo(() => {
    const raw = (modelsQuery.data as { data?: Array<CloudModel & { pricing?: ModelPricing | null }> })?.data ?? [];
    return raw.map((m) => ({
      id: m.id,
      ownedBy: m.owned_by,
      premium: m.premium,
      created: m.created,
      pricing: (m as { pricing?: ModelPricing | null }).pricing ?? null,
    }));
  }, [modelsQuery.data]);

  const providers = useMemo(() => {
    const set = new Set(allModels.map((m) => m.ownedBy));
    return Array.from(set).sort();
  }, [allModels]);

  const filteredModels = useMemo(() => {
    if (!providerFilter) return allModels;
    return allModels.filter((m) => m.ownedBy === providerFilter);
  }, [allModels, providerFilter]);

  const columns: ConsoleColumnDef<ModelRow>[] = [
    {
      accessorKey: "id",
      id: "id",
      header: "Model",
      size: 240,
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.id}</span>,
    },
    {
      accessorKey: "ownedBy",
      id: "ownedBy",
      header: "Provider",
      size: 160,
      cell: ({ row }) => {
        const provider = row.original.ownedBy;
        return <span className="text-sm">{providerLabels[provider] ?? provider}</span>;
      },
    },
    {
      accessorKey: "premium",
      id: "premium",
      header: "Tier",
      size: 90,
      cell: ({ row }) =>
        row.original.premium ? <Badge variant="default">Premium</Badge> : <Badge variant="secondary">Free</Badge>,
    },
    {
      id: "inputPrice",
      header: "Input / MTok",
      size: 120,
      cell: ({ row }) => {
        const p = row.original.pricing;
        const price = p?.inputCostPerMTok ?? (p?.inputCostPerToken ? p.inputCostPerToken * 1_000_000 : undefined);
        return <span className="text-sm tabular-nums">{formatPrice(price)}</span>;
      },
    },
    {
      id: "outputPrice",
      header: "Output / MTok",
      size: 120,
      cell: ({ row }) => {
        const p = row.original.pricing;
        const price = p?.outputCostPerMTok ?? (p?.outputCostPerToken ? p.outputCostPerToken * 1_000_000 : undefined);
        return <span className="text-sm tabular-nums">{formatPrice(price)}</span>;
      },
    },
    {
      accessorKey: "created",
      id: "created",
      header: "Available Since",
      size: 140,
      cell: ({ row }) => new Date(row.original.created * 1000).toLocaleDateString(),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Available Models
          {!modelsQuery.isPending && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({filteredModels.length}
              {providerFilter ? ` of ${allModels.length}` : ""})
            </span>
          )}
        </h3>
      </div>

      {providers.length > 1 && (
        <ProviderFilter providers={providers} selected={providerFilter} onSelect={setProviderFilter} />
      )}

      <DataTable
        tableName="cloudModels"
        columns={columns}
        data={
          modelsQuery.isPending
            ? { isLoading: true, isError: false }
            : modelsQuery.isError
              ? {
                  isLoading: false,
                  isError: true,
                  error: modelsQuery.error.message,
                }
              : {
                  isLoading: false,
                  isError: false,
                  data: filteredModels,
                }
        }
      />
    </div>
  );
}
