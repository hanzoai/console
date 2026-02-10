import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "../../adapters";
import {
  getMachine,
  updateMachine,
  deleteMachine,
  type CasvisorMachine,
} from "../../services/casvisorApi";
import { Button } from "@/src/features/agents/components/ui/button";
import { Badge } from "@/src/features/agents/components/ui/badge";
import { PageHeader } from "../../components/PageHeader";

function InfoRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-4 py-2 border-b border-zinc-800 last:border-0">
      <span className="text-xs text-zinc-500 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-white font-mono">{value}</span>
    </div>
  );
}

export function MachineDetailPage() {
  const params = useParams<{ owner: string; machineId: string }>();
  const navigate = useNavigate();
  const [machine, setMachine] = useState<CasvisorMachine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const machineId = `${params.owner}/${params.machineId}`;

  const fetchMachine = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMachine(machineId);
      setMachine(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load machine");
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    void fetchMachine();
  }, [fetchMachine]);

  const handleDelete = async () => {
    if (!machine) return;
    if (!confirm(`Delete machine "${machine.displayName || machine.name}"?`)) return;
    try {
      await deleteMachine({ owner: machine.owner, name: machine.name });
      navigate("/compute");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        <div className="animate-spin h-5 w-5 border-2 border-zinc-500 border-t-transparent rounded-full mr-3" />
        Loading machine...
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400">
          {error || "Machine not found"}
        </div>
        <Button variant="outline" onClick={() => navigate("/compute")}>
          Back to Compute
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={machine.displayName || machine.name}
        description={`${machine.provider} · ${machine.region || "no region"}`}
        actions={[
          {
            label: "Back",
            onClick: () => navigate("/compute"),
            variant: "outline" as const,
          },
          {
            label: "Delete",
            onClick: () => void handleDelete(),
            variant: "destructive" as const,
          },
        ]}
      />

      {/* Status bar */}
      <div className="flex items-center gap-3">
        <Badge
          className={
            machine.state === "Running"
              ? "bg-emerald-500/10 text-emerald-400"
              : machine.state === "Stopped"
                ? "bg-zinc-500/10 text-zinc-400"
                : "bg-amber-500/10 text-amber-400"
          }
        >
          {machine.state || "Unknown"}
        </Badge>
        {machine.publicIp && (
          <span className="text-sm font-mono text-zinc-300">{machine.publicIp}</span>
        )}
        {machine.privateIp && (
          <span className="text-xs font-mono text-zinc-500">
            (private: {machine.privateIp})
          </span>
        )}
      </div>

      {/* Info sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Instance</h3>
          <InfoRow label="Name" value={machine.name} />
          <InfoRow label="ID" value={machine.id} />
          <InfoRow label="Provider" value={machine.provider} />
          <InfoRow label="Type" value={machine.type} />
          <InfoRow label="Size" value={machine.size} />
          <InfoRow label="Category" value={machine.category} />
          <InfoRow label="Tag" value={machine.tag} />
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Hardware</h3>
          <InfoRow label="CPU" value={machine.cpuSize ? `${machine.cpuSize} vCPU` : undefined} />
          <InfoRow label="Memory" value={machine.memSize} />
          <InfoRow label="OS" value={machine.os} />
          <InfoRow label="Image" value={machine.image} />
          <InfoRow label="Region" value={machine.region} />
          <InfoRow label="Zone" value={machine.zone} />
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Network</h3>
          <InfoRow label="Public IP" value={machine.publicIp} />
          <InfoRow label="Private IP" value={machine.privateIp} />
          <InfoRow label="Protocol" value={machine.remoteProtocol} />
          <InfoRow label="Port" value={machine.remotePort || undefined} />
          <InfoRow label="Username" value={machine.remoteUsername} />
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Timestamps</h3>
          <InfoRow label="Created" value={machine.createdTime} />
          <InfoRow label="Updated" value={machine.updatedTime} />
          <InfoRow label="Expires" value={machine.expireTime} />
        </div>
      </div>
    </div>
  );
}
