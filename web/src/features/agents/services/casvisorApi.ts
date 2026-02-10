/**
 * Casvisor compute management API client.
 *
 * All requests go through /api/compute/* proxy which forwards to the
 * Casvisor backend (CASVISOR_API_URL, server-side only).
 */

// ---------------------------------------------------------------------------
// Types (mirroring Casvisor's Go structs)
// ---------------------------------------------------------------------------

export interface CasvisorMachine {
  owner: string;
  name: string;
  id: string;
  provider: string;
  createdTime: string;
  updatedTime: string;
  expireTime: string;
  displayName: string;
  region: string;
  zone: string;
  category: string;
  type: string;
  size: string;
  tag: string;
  state: string;
  image: string;
  os: string;
  publicIp: string;
  privateIp: string;
  cpuSize: string;
  memSize: string;
  remoteProtocol: string;
  remotePort: number;
  remoteUsername: string;
  remotePassword: string;
}

export interface CasvisorProvider {
  owner: string;
  name: string;
  createdTime: string;
  updatedTime: string;
  displayName: string;
  category: string;
  type: string; // "AWS" | "Azure" | "GCP" | "Aliyun" | "KVM" | "PVE" | "VMware" | "DigitalOcean"
  clientId: string;
  clientSecret: string;
  region: string;
  network: string;
  chain: string;
  browserUrl: string;
  state: string;
  providerUrl: string;
}

export type ProviderType =
  | "AWS"
  | "Azure"
  | "GCP"
  | "Aliyun"
  | "KVM"
  | "PVE"
  | "VMware"
  | "DigitalOcean";

export interface CasvisorSession {
  owner: string;
  name: string;
  createdTime: string;
  updatedTime: string;
  protocol: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Base URL / fetch helper
// ---------------------------------------------------------------------------

const PROXY_BASE = "/api/compute";

async function casvisorFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${PROXY_BASE}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Casvisor API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------

export async function getMachines(owner?: string): Promise<CasvisorMachine[]> {
  const qs = owner ? `?owner=${encodeURIComponent(owner)}` : "";
  return casvisorFetch<CasvisorMachine[]>(`get-machines${qs}`);
}

export async function getMachine(id: string): Promise<CasvisorMachine> {
  return casvisorFetch<CasvisorMachine>(
    `get-machine?id=${encodeURIComponent(id)}`,
  );
}

export async function addMachine(
  machine: Partial<CasvisorMachine>,
): Promise<{ status: string }> {
  return casvisorFetch<{ status: string }>("add-machine", {
    method: "POST",
    body: JSON.stringify(machine),
  });
}

export async function updateMachine(
  machine: CasvisorMachine,
): Promise<{ status: string }> {
  return casvisorFetch<{ status: string }>("update-machine", {
    method: "POST",
    body: JSON.stringify(machine),
  });
}

export async function deleteMachine(
  machine: Pick<CasvisorMachine, "owner" | "name">,
): Promise<{ status: string }> {
  return casvisorFetch<{ status: string }>("delete-machine", {
    method: "POST",
    body: JSON.stringify(machine),
  });
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export async function getProviders(
  owner?: string,
): Promise<CasvisorProvider[]> {
  const qs = owner ? `?owner=${encodeURIComponent(owner)}` : "";
  return casvisorFetch<CasvisorProvider[]>(`get-providers${qs}`);
}

export async function getProvider(id: string): Promise<CasvisorProvider> {
  return casvisorFetch<CasvisorProvider>(
    `get-provider?id=${encodeURIComponent(id)}`,
  );
}

export async function addProvider(
  provider: Partial<CasvisorProvider>,
): Promise<{ status: string }> {
  return casvisorFetch<{ status: string }>("add-provider", {
    method: "POST",
    body: JSON.stringify(provider),
  });
}

export async function updateProvider(
  provider: CasvisorProvider,
): Promise<{ status: string }> {
  return casvisorFetch<{ status: string }>("update-provider", {
    method: "POST",
    body: JSON.stringify(provider),
  });
}

export async function deleteProvider(
  provider: Pick<CasvisorProvider, "owner" | "name">,
): Promise<{ status: string }> {
  return casvisorFetch<{ status: string }>("delete-provider", {
    method: "POST",
    body: JSON.stringify(provider),
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function getSessions(
  owner?: string,
): Promise<CasvisorSession[]> {
  const qs = owner ? `?owner=${encodeURIComponent(owner)}` : "";
  return casvisorFetch<CasvisorSession[]>(`get-sessions${qs}`);
}

export async function startSession(
  session: Pick<CasvisorSession, "owner" | "name">,
): Promise<{ status: string }> {
  return casvisorFetch<{ status: string }>("start-session", {
    method: "POST",
    body: JSON.stringify(session),
  });
}

export async function stopSession(
  session: Pick<CasvisorSession, "owner" | "name">,
): Promise<{ status: string }> {
  return casvisorFetch<{ status: string }>("stop-session", {
    method: "POST",
    body: JSON.stringify(session),
  });
}
