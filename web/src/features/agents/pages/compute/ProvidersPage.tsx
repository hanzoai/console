import { useState, useEffect, useCallback } from "react";
import {
  getProviders,
  addProvider,
  deleteProvider,
  type CasvisorProvider,
  type ProviderType,
} from "../../services/casvisorApi";
import { Button } from "@/src/features/agents/components/ui/button";
import { PageHeader } from "../../components/PageHeader";

const PROVIDER_TYPES: { value: ProviderType; label: string; description: string }[] = [
  { value: "AWS", label: "Amazon Web Services", description: "EC2 instances" },
  { value: "Azure", label: "Microsoft Azure", description: "Virtual Machines" },
  { value: "GCP", label: "Google Cloud Platform", description: "Compute Engine" },
  { value: "DigitalOcean", label: "DigitalOcean", description: "Droplets" },
  { value: "Aliyun", label: "Alibaba Cloud", description: "ECS instances" },
  { value: "KVM", label: "KVM / libvirt", description: "Local/bare-metal VMs" },
  { value: "PVE", label: "Proxmox VE", description: "Proxmox hypervisor" },
  { value: "VMware", label: "VMware vSphere", description: "ESXi / vCenter" },
];

export function ProvidersPage() {
  const [providers, setProviders] = useState<CasvisorProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    displayName: "",
    type: "AWS" as ProviderType,
    clientId: "",
    clientSecret: "",
    region: "",
  });

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProviders();
      setProviders(data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load providers",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    try {
      await addProvider({
        owner: "admin",
        name: form.name,
        displayName: form.displayName || form.name,
        type: form.type,
        category: "Cloud",
        clientId: form.clientId,
        clientSecret: form.clientSecret,
        region: form.region,
      });
      setShowAdd(false);
      setForm({
        name: "",
        displayName: "",
        type: "AWS",
        clientId: "",
        clientSecret: "",
        region: "",
      });
      await fetchProviders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add provider");
    }
  };

  const handleDelete = async (provider: CasvisorProvider) => {
    if (
      !confirm(
        `Delete provider "${provider.displayName || provider.name}"?`,
      )
    )
      return;
    try {
      await deleteProvider({ owner: provider.owner, name: provider.name });
      await fetchProviders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cloud Providers"
        description={`${providers.length} provider${providers.length !== 1 ? "s" : ""} configured`}
        actions={[
          {
            label: showAdd ? "Cancel" : "Add Provider",
            onClick: () => setShowAdd(!showAdd),
            variant: showAdd ? ("outline" as const) : ("default" as const),
          },
        ]}
      />

      {/* Add provider form */}
      {showAdd && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-6 space-y-4">
          <h3 className="text-sm font-medium text-white">
            New Cloud Provider
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Provider Type
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as ProviderType })
                }
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
              >
                {PROVIDER_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label} — {pt.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="my-aws-account"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Access Key / Client ID
              </label>
              <input
                type="text"
                value={form.clientId}
                onChange={(e) =>
                  setForm({ ...form, clientId: e.target.value })
                }
                placeholder="AKIA..."
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Secret Key / Client Secret
              </label>
              <input
                type="password"
                value={form.clientSecret}
                onChange={(e) =>
                  setForm({ ...form, clientSecret: e.target.value })
                }
                placeholder="••••••••"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Region
              </label>
              <input
                type="text"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="us-east-1"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
                placeholder="Production AWS"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!form.name.trim()}>
              Add Provider
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-zinc-500">
          <div className="animate-spin h-5 w-5 border-2 border-zinc-500 border-t-transparent rounded-full mr-3" />
          Loading providers...
        </div>
      )}

      {!loading && providers.length === 0 && !error && (
        <div className="text-center py-12 text-zinc-500">
          <p className="text-lg mb-2">No providers configured</p>
          <p className="text-sm">
            Add a cloud provider to start provisioning machines.
          </p>
        </div>
      )}

      {!loading && providers.length > 0 && (
        <div className="grid gap-3">
          {providers.map((provider) => (
            <div
              key={`${provider.owner}/${provider.name}`}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-white">
                    {provider.displayName || provider.name}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {provider.type}
                    {provider.region && ` · ${provider.region}`}
                    {provider.clientId && ` · ${provider.clientId.slice(0, 8)}...`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      provider.state === "Active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-zinc-500/10 text-zinc-400"
                    }`}
                  >
                    {provider.state || "Unknown"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => void handleDelete(provider)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
