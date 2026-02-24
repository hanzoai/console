import { useQuery } from "@tanstack/react-query";
import { mpcFetch } from "./mpcClient";
import type { MpcDashboardSummary, MpcWallet, MpcSigningSession, MpcHealthStatus } from "./types";

// ---------------------------------------------------------------------------
// MPC React Query hooks
// ---------------------------------------------------------------------------

const mpcKeys = {
  all: ["mpc"] as const,
  dashboard: (projectId: string) => ["mpc", "dashboard", projectId] as const,
  wallets: (projectId: string) => ["mpc", "wallets", projectId] as const,
  wallet: (projectId: string, id: string) => ["mpc", "wallet", projectId, id] as const,
  sessions: (projectId: string) => ["mpc", "sessions", projectId] as const,
  health: () => ["mpc", "health"] as const,
};

// ── Dashboard ─────────────────────────────────────────────────────────

export function useMpcDashboard(projectId: string) {
  return useQuery({
    queryKey: mpcKeys.dashboard(projectId),
    queryFn: () => mpcFetch<MpcDashboardSummary>(`/dashboard?projectId=${projectId}`),
    enabled: !!projectId,
    refetchInterval: 30_000,
  });
}

// ── Wallets ───────────────────────────────────────────────────────────

export function useMpcWallets(projectId: string) {
  return useQuery({
    queryKey: mpcKeys.wallets(projectId),
    queryFn: () => mpcFetch<{ data: MpcWallet[] }>(`/wallets?projectId=${projectId}`),
    enabled: !!projectId,
    refetchInterval: 30_000,
  });
}

export function useMpcWallet(projectId: string, walletId: string) {
  return useQuery({
    queryKey: mpcKeys.wallet(projectId, walletId),
    queryFn: () => mpcFetch<{ data: MpcWallet }>(`/wallets/${walletId}?projectId=${projectId}`),
    enabled: !!projectId && !!walletId,
  });
}

// ── Signing Sessions ──────────────────────────────────────────────────

export function useMpcSessions(projectId: string) {
  return useQuery({
    queryKey: mpcKeys.sessions(projectId),
    queryFn: () => mpcFetch<{ data: MpcSigningSession[] }>(`/sessions?projectId=${projectId}`),
    enabled: !!projectId,
    refetchInterval: 15_000,
  });
}

// ── Health ────────────────────────────────────────────────────────────

export function useMpcHealth() {
  return useQuery({
    queryKey: mpcKeys.health(),
    queryFn: () => mpcFetch<MpcHealthStatus>("/health"),
    refetchInterval: 60_000,
    retry: 1,
  });
}
