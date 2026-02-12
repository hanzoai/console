import { useState, useEffect } from "react";
import {
  addMachine,
  getProviders,
  type CasvisorProvider,
  type ProviderType,
} from "../../services/casvisorApi";
import { useNavigate } from "../../adapters";
import { Button } from "@/src/features/agents/components/ui/button";
import { PageHeader } from "../../components/PageHeader";

type OSType = "linux" | "windows" | "macos";

interface OSOption {
  id: OSType;
  label: string;
  icon: string;
  description: string;
  allowedProviders: ProviderType[];
}

const OS_OPTIONS: OSOption[] = [
  {
    id: "linux",
    label: "Linux",
    icon: "🐧",
    description: "Ubuntu, Debian, RHEL — runs on any provider including DOKS",
    allowedProviders: [
      "AWS",
      "Azure",
      "GCP",
      "DigitalOcean",
      "Aliyun",
      "KVM",
      "PVE",
      "VMware",
    ],
  },
  {
    id: "windows",
    label: "Windows",
    icon: "🪟",
    description:
      "Windows Server — runs on AWS, Azure, GCP, or DigitalOcean",
    allowedProviders: ["AWS", "Azure", "GCP", "DigitalOcean"],
  },
  {
    id: "macos",
    label: "macOS",
    icon: "🍎",
    description:
      "macOS on AWS Mac instances (mac2.metal) — requires Dedicated Host",
    allowedProviders: ["AWS"],
  },
];

interface SizePreset {
  id: string;
  label: string;
  cpu: string;
  memory: string;
  description: string;
}

const SIZE_PRESETS: Record<OSType, SizePreset[]> = {
  linux: [
    {
      id: "small",
      label: "Small",
      cpu: "2",
      memory: "4GB",
      description: "Light workloads, single agent",
    },
    {
      id: "medium",
      label: "Medium",
      cpu: "4",
      memory: "8GB",
      description: "Standard workloads, multiple agents",
    },
    {
      id: "large",
      label: "Large",
      cpu: "8",
      memory: "16GB",
      description: "Heavy workloads, parallel agents",
    },
    {
      id: "xlarge",
      label: "X-Large",
      cpu: "16",
      memory: "32GB",
      description: "Production workloads, full Hanzo Bot",
    },
  ],
  windows: [
    {
      id: "medium",
      label: "Medium",
      cpu: "4",
      memory: "8GB",
      description: "Standard Windows workloads",
    },
    {
      id: "large",
      label: "Large",
      cpu: "8",
      memory: "16GB",
      description: "Heavy workloads with GUI",
    },
    {
      id: "xlarge",
      label: "X-Large",
      cpu: "16",
      memory: "32GB",
      description: "Production Windows Server",
    },
  ],
  macos: [
    {
      id: "mac2-metal",
      label: "Mac2 Metal",
      cpu: "12",
      memory: "32GB",
      description:
        "Apple M2 Pro — Dedicated Host, ideal for iOS/macOS development",
    },
  ],
};

const LINUX_IMAGES = [
  { id: "ubuntu-24.04", label: "Ubuntu 24.04 LTS" },
  { id: "ubuntu-22.04", label: "Ubuntu 22.04 LTS" },
  { id: "debian-12", label: "Debian 12" },
  { id: "rhel-9", label: "RHEL 9" },
];

const WINDOWS_IMAGES = [
  { id: "windows-server-2022", label: "Windows Server 2022" },
  { id: "windows-server-2019", label: "Windows Server 2019" },
];

const MACOS_IMAGES = [
  { id: "macos-sonoma", label: "macOS 15 Sequoia" },
  { id: "macos-ventura", label: "macOS 14 Sonoma" },
];

const IMAGES: Record<OSType, { id: string; label: string }[]> = {
  linux: LINUX_IMAGES,
  windows: WINDOWS_IMAGES,
  macos: MACOS_IMAGES,
};

const REGIONS: Record<ProviderType, { id: string; label: string }[]> = {
  AWS: [
    { id: "us-east-1", label: "US East (N. Virginia)" },
    { id: "us-west-2", label: "US West (Oregon)" },
    { id: "eu-west-1", label: "EU (Ireland)" },
    { id: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  ],
  DigitalOcean: [
    { id: "sfo3", label: "San Francisco 3" },
    { id: "nyc3", label: "New York 3" },
    { id: "ams3", label: "Amsterdam 3" },
    { id: "sgp1", label: "Singapore 1" },
  ],
  Azure: [
    { id: "eastus", label: "East US" },
    { id: "westus2", label: "West US 2" },
    { id: "westeurope", label: "West Europe" },
  ],
  GCP: [
    { id: "us-central1", label: "Iowa" },
    { id: "us-east1", label: "South Carolina" },
    { id: "europe-west1", label: "Belgium" },
  ],
  Aliyun: [{ id: "cn-hangzhou", label: "Hangzhou" }],
  KVM: [{ id: "local", label: "Local" }],
  PVE: [{ id: "local", label: "Local" }],
  VMware: [{ id: "local", label: "Local" }],
};

export function CreateMachinePage() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<CasvisorProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wizard state
  const [step, setStep] = useState(1);
  const [os, setOs] = useState<OSType | null>(null);
  const [provider, setProvider] = useState<ProviderType | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [image, setImage] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [name, setName] = useState("");
  const [installBot, setInstallBot] = useState(true);
  const [registerK8s, setRegisterK8s] = useState(true);

  useEffect(() => {
    getProviders()
      .then((p) => setProviders(p ?? []))
      .catch(() => {});
  }, []);

  const configuredProviderTypes = new Set(
    providers.map((p) => p.type as ProviderType),
  );

  const availableProviders = os
    ? OS_OPTIONS.find((o) => o.id === os)?.allowedProviders.filter((p) =>
        configuredProviderTypes.has(p),
      ) ?? []
    : [];

  const handleCreate = async () => {
    if (!os || !provider || !size || !name) return;

    const sizePreset = SIZE_PRESETS[os].find((s) => s.id === size);

    setLoading(true);
    setError(null);
    try {
      await addMachine({
        name: name.toLowerCase().replace(/\s+/g, "-"),
        displayName: name,
        os: os === "macos" ? "macOS" : os === "windows" ? "Windows" : "Linux",
        image: image || undefined,
        provider,
        region: region || undefined,
        cpuSize: sizePreset?.cpu,
        memSize: sizePreset?.memory,
        size: size,
        tag: [
          installBot ? "hanzo-bot" : "",
          registerK8s ? "k8s-node" : "",
        ]
          .filter(Boolean)
          .join(","),
      });
      navigate("/compute");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create machine");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Launch Hanzo VM"
        description="Select an operating system, provider, and size to launch a new virtual machine."
        actions={[
          {
            label: "Cancel",
            onClick: () => navigate("/compute"),
            variant: "outline" as const,
          },
        ]}
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        {["OS", "Provider", "Size", "Configure"].map((s, i) => (
          <span key={s} className="flex items-center gap-1">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                step > i + 1
                  ? "bg-emerald-500/20 text-emerald-400"
                  : step === i + 1
                    ? "bg-white/10 text-white"
                    : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {step > i + 1 ? "✓" : i + 1}
            </span>
            <span className={step === i + 1 ? "text-white" : ""}>{s}</span>
            {i < 3 && <span className="mx-1 text-zinc-700">→</span>}
          </span>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: OS Selection */}
      {step === 1 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">
            Select Operating System
          </h3>
          <div className="grid gap-3">
            {OS_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  setOs(option.id);
                  setProvider(null);
                  setSize(null);
                  setImage(IMAGES[option.id][0]?.id ?? "");
                  // Auto-select provider if only one option
                  const available =
                    option.allowedProviders.filter((p) =>
                      configuredProviderTypes.has(p),
                    );
                  if (available.length === 1) {
                    setProvider(available[0]);
                  }
                  setStep(2);
                }}
                className={`flex items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
                  os === option.id
                    ? "border-blue-500/50 bg-blue-500/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
                }`}
              >
                <span className="text-3xl">{option.icon}</span>
                <div>
                  <div className="font-medium text-white">{option.label}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {option.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Provider Selection */}
      {step === 2 && os && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">
            Select Cloud Provider
          </h3>
          {availableProviders.length === 0 ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-amber-400 text-sm">
              No providers configured for {os}. Go to{" "}
              <button
                className="underline"
                onClick={() => navigate("/compute/providers")}
              >
                Providers
              </button>{" "}
              to add one.
            </div>
          ) : (
            <div className="grid gap-2">
              {availableProviders.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setProvider(p);
                    setRegion(REGIONS[p]?.[0]?.id ?? "");
                    setStep(3);
                  }}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    provider === p
                      ? "border-blue-500/50 bg-blue-500/10"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
                  }`}
                >
                  <span className="font-medium text-white">{p}</span>
                  {os === "macos" && p === "AWS" && (
                    <span className="text-xs text-amber-400">
                      Dedicated Host required
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep(1)}
          >
            Back
          </Button>
        </div>
      )}

      {/* Step 3: Size Selection */}
      {step === 3 && os && provider && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">Select Size</h3>
          <div className="grid gap-2">
            {SIZE_PRESETS[os].map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setSize(preset.id);
                  setStep(4);
                }}
                className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                  size === preset.id
                    ? "border-blue-500/50 bg-blue-500/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
                }`}
              >
                <div>
                  <div className="font-medium text-white">{preset.label}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {preset.description}
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <div>{preset.cpu} vCPU</div>
                  <div>{preset.memory}</div>
                </div>
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep(2)}
          >
            Back
          </Button>
        </div>
      )}

      {/* Step 4: Configure & Launch */}
      {step === 4 && os && provider && size && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-zinc-300">
            Configure & Launch
          </h3>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Machine Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-agent-vm"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Image */}
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Image</label>
            <select
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {IMAGES[os].map((img) => (
                <option key={img.id} value={img.id}>
                  {img.label}
                </option>
              ))}
            </select>
          </div>

          {/* Region */}
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {(REGIONS[provider] ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={installBot}
                onChange={(e) => setInstallBot(e.target.checked)}
                className="rounded border-zinc-700"
              />
              Install Hanzo Bot automatically
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={registerK8s}
                onChange={(e) => setRegisterK8s(e.target.checked)}
                className="rounded border-zinc-700"
              />
              Register as Kubernetes node
            </label>
          </div>

          {/* Summary */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400 space-y-1">
            <div>
              <span className="text-zinc-500">OS:</span>{" "}
              {OS_OPTIONS.find((o) => o.id === os)?.label}
            </div>
            <div>
              <span className="text-zinc-500">Provider:</span> {provider}
            </div>
            <div>
              <span className="text-zinc-500">Size:</span>{" "}
              {SIZE_PRESETS[os].find((s) => s.id === size)?.label} (
              {SIZE_PRESETS[os].find((s) => s.id === size)?.cpu} vCPU /{" "}
              {SIZE_PRESETS[os].find((s) => s.id === size)?.memory})
            </div>
            <div>
              <span className="text-zinc-500">Image:</span>{" "}
              {IMAGES[os].find((i) => i.id === image)?.label ?? image}
            </div>
            <div>
              <span className="text-zinc-500">Region:</span>{" "}
              {REGIONS[provider]?.find((r) => r.id === region)?.label ?? region}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(3)}
            >
              Back
            </Button>
            <Button
              size="sm"
              disabled={!name || loading}
              onClick={handleCreate}
            >
              {loading ? "Launching..." : "Launch Hanzo VM"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
