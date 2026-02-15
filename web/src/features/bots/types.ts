export type BotStatus = "running" | "stopped" | "provisioning" | "error";
export type BotPlatform = "linux" | "macos" | "windows";
export type BotTier = "free" | "cloud" | "cloud-pro";
export type BotChannel =
  | "whatsapp"
  | "telegram"
  | "discord"
  | "slack"
  | "web"
  | "sms"
  | "email";

export const BOT_CHANNELS: BotChannel[] = [
  "whatsapp",
  "telegram",
  "discord",
  "slack",
  "web",
  "sms",
  "email",
];

export const BOT_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "EU West (Ireland)" },
] as const;

export const BOT_PLATFORM_PRICING: Record<
  BotPlatform,
  { label: string; price: number }
> = {
  linux: { label: "Linux", price: 5 },
  macos: { label: "macOS", price: 25 },
  windows: { label: "Windows", price: 25 },
};

export const BOT_MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4",
  "gpt-4o",
  "gpt-4o-mini",
  "qwen3-235b",
  "qwen3-32b",
] as const;

export interface BotMonthlyUsage {
  messages: number;
  tokens: number;
  cost: number;
}

/** W3C Decentralized Identifier for a bot agent */
export interface BotDID {
  uri?: string;
  method?: "hanzo" | "lux" | "pars" | "zoo" | "ai";
  chainId?: number;
}

/** On-chain Safe wallet for a bot agent */
export interface BotWallet {
  address?: string;
  safeAddress?: string;
  chain?: "lux" | "hanzo" | "zoo" | "pars";
  chainId?: number;
  derivationPath?: string;
}

/** Team preset metadata */
export interface TeamPreset {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
}

export interface Bot {
  id: string;
  name: string;
  status: BotStatus;
  platform: BotPlatform;
  tier: BotTier;
  region: string;
  instanceType: string;
  createdAt: Date;
  lastActiveAt: Date;
  channels: BotChannel[];
  modelsEnabled: string[];
  memoryUsageMb: number;
  monthlyUsage: BotMonthlyUsage;
  did?: BotDID;
  wallet?: BotWallet;
}

export interface BotLogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

export interface BotInvoice {
  id: string;
  date: Date;
  amount: number;
  status: "paid" | "pending" | "overdue";
  description: string;
  paymentMethod?: PaymentMethodType;
}

// Payment methods — powered by Hanzo Commerce (not Stripe)
export type PaymentMethodType = "card" | "crypto" | "wire";

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  label: string;
  last4?: string; // card last 4
  brand?: string; // e.g. "visa", "mastercard"
  walletAddress?: string; // crypto
  network?: string; // e.g. "ethereum", "bitcoin", "solana"
  bankName?: string; // wire
  isDefault: boolean;
}

// Hanzo Commerce API base URL
export const COMMERCE_API_URL =
  process.env.NEXT_PUBLIC_COMMERCE_API_URL ?? "https://commerce.hanzo.ai/api/v1";
