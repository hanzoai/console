// ---------------------------------------------------------------------------
// MPC type definitions
// ---------------------------------------------------------------------------

/** Elliptic curve used by an MPC wallet. */
export type MpcCurve = "secp256k1" | "ed25519" | "secp256r1";

/** Runtime status of a wallet. */
export type MpcWalletStatus = "active" | "pending" | "archived";

/** A single MPC wallet returned by the API. */
export interface MpcWallet {
  id: string;
  curve: MpcCurve;
  threshold: number;
  parties: number;
  status: MpcWalletStatus;
  publicKey: string;
  createdAt: string;
  lastSignedAt: string | null;
}

/** A signing session (completed or in-flight). */
export interface MpcSigningSession {
  id: string;
  walletId: string;
  status: "pending" | "signing" | "completed" | "failed";
  signers: number;
  requiredSigners: number;
  latencyMs: number | null;
  createdAt: string;
  completedAt: string | null;
}

/** Dashboard summary returned by GET /api/dashboard. */
export interface MpcDashboardSummary {
  totalWallets: number;
  activeSigners: number;
  sessions24h: number;
  avgLatencyMs: number | null;
}

/** Health status from GET /api/health. */
export interface MpcHealthStatus {
  status: "ok" | "degraded" | "down";
  version: string;
  uptime: number;
}
