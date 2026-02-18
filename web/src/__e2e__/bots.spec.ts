import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Mock data matching Bot, BotLogEntry, BotInvoice types
// ---------------------------------------------------------------------------

const MOCK_BOTS = [
  {
    id: "bot-001",
    name: "Support Agent",
    status: "running",
    platform: "linux",
    tier: "cloud",
    region: "us-east-1",
    instanceType: "t3.medium",
    channels: ["discord", "telegram"],
    modelsEnabled: ["claude-sonnet-4-20250514", "gpt-4o"],
    memoryUsageMb: 142,
    monthlyUsage: { messages: 12450, tokens: 3_200_000, cost: 18.72 },
    createdAt: "2026-01-10T08:00:00Z",
    lastActiveAt: "2026-02-14T12:34:56Z",
  },
  {
    id: "bot-002",
    name: "Sales Bot",
    status: "stopped",
    platform: "macos",
    tier: "cloud-pro",
    region: "eu-west-1",
    instanceType: "mac2.metal",
    channels: ["slack", "whatsapp"],
    modelsEnabled: ["claude-sonnet-4-20250514"],
    memoryUsageMb: 0,
    monthlyUsage: { messages: 0, tokens: 0, cost: 0 },
    createdAt: "2026-02-01T10:00:00Z",
    lastActiveAt: "2026-02-10T09:00:00Z",
  },
  {
    id: "bot-003",
    name: "Dev Helper",
    status: "provisioning",
    platform: "linux",
    tier: "free",
    region: "ap-southeast-1",
    instanceType: "t3.micro",
    channels: ["telegram"],
    modelsEnabled: ["gpt-4o-mini"],
    memoryUsageMb: 0,
    monthlyUsage: { messages: 0, tokens: 0, cost: 0 },
    createdAt: "2026-02-14T11:00:00Z",
    lastActiveAt: "2026-02-14T11:00:00Z",
  },
];

const MOCK_LOGS = [
  {
    id: "log-1",
    timestamp: "2026-02-14T12:34:56Z",
    level: "info",
    message: "Gateway started on port 18789",
  },
  {
    id: "log-2",
    timestamp: "2026-02-14T12:35:01Z",
    level: "info",
    message: "Discord channel connected",
  },
  {
    id: "log-3",
    timestamp: "2026-02-14T12:35:02Z",
    level: "info",
    message: "Telegram channel connected",
  },
  {
    id: "log-4",
    timestamp: "2026-02-14T12:36:10Z",
    level: "warn",
    message: "Rate limit approaching for project prj-abc",
  },
  {
    id: "log-5",
    timestamp: "2026-02-14T12:37:00Z",
    level: "error",
    message: "Webhook delivery failed: 503 Service Unavailable",
  },
];

const MOCK_BILLING = {
  currentPlan: "cloud",
  monthlyBase: 5,
  usage: { messages: 12450, tokens: 3_200_000, cost: 18.72 },
  invoices: [
    {
      id: "inv-001",
      date: "2026-02-01T00:00:00Z",
      description: "Cloud plan - February 2026",
      status: "paid",
      amount: 23.72,
      paymentMethod: "card",
    },
    {
      id: "inv-002",
      date: "2026-01-01T00:00:00Z",
      description: "Cloud plan - January 2026",
      status: "paid",
      amount: 31.5,
      paymentMethod: "crypto",
    },
  ],
};

const MOCK_PAYMENT_METHODS = [
  {
    id: "pm-001",
    type: "card",
    label: "Visa ending in 4242",
    last4: "4242",
    brand: "visa",
    isDefault: true,
  },
  {
    id: "pm-002",
    type: "crypto",
    label: "ETH Wallet 0x1a2b...3c4d",
    isDefault: false,
  },
];

const MOCK_CREDITS = { balance: 42.5, currency: "USD" };

const MOCK_BALANCE = {
  balance: 4250,
  holds: 0,
  available: 4250,
  currency: "usd",
};

const PROJECT_ID = "7a88fb47-b4e2-43b8-a06c-a5ce950dc53a";

const MOCK_SESSION = {
  user: {
    id: "demo-user-id",
    name: "Demo User",
    email: "demo@hanzo.ai",
    image: null,
    admin: true,
    canCreateOrganizations: true,
    organizations: [
      {
        id: "seed-org-id",
        name: "Test Organization",
        role: "OWNER",
        plan: "cloud:free",
        cloudConfig: null,
        projects: [
          {
            id: PROJECT_ID,
            role: "ADMIN",
            retentionDays: 30,
            deletedAt: null,
            name: "Test Project",
          },
        ],
      },
    ],
    featureFlags: {
      excludeClickhouseRead: false,
      templateFlag: true,
    },
  },
  expires: "2099-12-31T23:59:59.999Z",
  environment: {
    selfHostedInstancePlan: undefined,
    disableExternalAuth: false,
    defaultTableDateTimeOffset: undefined,
  },
};

// ---------------------------------------------------------------------------
// Auth bypass — mock session and intercept auth API routes
// ---------------------------------------------------------------------------

async function bypassAuth(page: Page) {
  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: "mock-e2e-session-token",
      url: "http://localhost:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SESSION),
    });
  });

  await page.route("**/api/auth/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "mock-csrf-token" }),
    });
  });

  await page.route("**/api/auth/providers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ credentials: { id: "credentials", name: "Credentials" } }),
    });
  });
}

// ---------------------------------------------------------------------------
// Unified tRPC mock — handles ALL tRPC calls in a single route handler.
// Bot procedures return mock data; everything else returns null.
// ---------------------------------------------------------------------------

const BOT_HANDLERS: Record<string, (input: any) => unknown> = {
  "bots.list": () => MOCK_BOTS,
  "bots.getById": (input: any) => {
    const botId = input?.botId ?? "bot-001";
    return MOCK_BOTS.find((b) => b.id === botId) ?? MOCK_BOTS[0];
  },
  "bots.getLogs": () => MOCK_LOGS,
  "bots.getBilling": () => MOCK_BILLING,
  "bots.listPaymentMethods": () => MOCK_PAYMENT_METHODS,
  "bots.getCredits": () => MOCK_CREDITS,
  "bots.getBalance": () => MOCK_BALANCE,
  "bots.getUsage": () => MOCK_BOTS[0]!.monthlyUsage,
  "bots.create": (input: any) => ({
    ...MOCK_BOTS[0],
    id: "bot-new",
    name: input?.name ?? "New Bot",
    status: "provisioning",
  }),
  "bots.start": () => ({ ...MOCK_BOTS[1], status: "running" }),
  "bots.stop": () => ({ ...MOCK_BOTS[0], status: "stopped" }),
  "bots.restart": () => MOCK_BOTS[0],
  "bots.delete": () => ({ ok: true }),
  "bots.upgradePlan": () => ({ ...MOCK_BOTS[0], tier: "cloud-pro" }),
  "bots.listSecrets": () => ({ secrets: [] }),
};

async function setupAllTrpcMocks(
  page: Page,
  overrides?: Record<string, (input: any) => unknown>,
) {
  const handlers = { ...BOT_HANDLERS, ...overrides };

  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const pathAfterTrpc = url.pathname.split("/api/trpc/")[1];
    if (!pathAfterTrpc) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });

    const isBatch = url.searchParams.has("batch");
    const procedures = isBatch ? pathAfterTrpc.split(",") : [pathAfterTrpc];

    const inputParam = url.searchParams.get("input");
    let parsedInputs: Record<string, any> = {};
    if (inputParam) {
      try { parsedInputs = JSON.parse(inputParam); } catch {}
    }

    const results = procedures.map((proc, idx) => {
      const handler = handlers[proc];
      if (!handler) {
        return { result: { data: { json: null } } };
      }
      try {
        // For batch: input keyed by index. For single: input at root or "0".
        const input = isBatch
          ? parsedInputs?.[String(idx)]?.json
          : (parsedInputs?.["0"]?.json ?? parsedInputs?.json ?? parsedInputs);
        return { result: { data: { json: handler(input) } } };
      } catch {
        return { result: { data: { json: handler(undefined) } } };
      }
    });

    // Non-batched (httpLink): return single object. Batched: return array.
    const body = isBatch ? JSON.stringify(results) : JSON.stringify(results[0]);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body,
    });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCREENSHOTS_DIR = "test-results/screenshots/bots";
const BOTS_URL = `/project/${PROJECT_ID}/bots`;

/**
 * Navigate to the bots page, bypassing auth and mocking all API calls.
 */
async function gotoBots(
  page: Page,
  trpcOverrides?: Record<string, (input: any) => unknown>,
) {
  await bypassAuth(page);
  await setupAllTrpcMocks(page, trpcOverrides);

  await page.goto(BOTS_URL);

  // If server-side middleware redirected, re-navigate (mocks are set)
  if (page.url().includes("/auth/sign-in")) {
    await page.goto(BOTS_URL, { waitUntil: "domcontentloaded" });
  }

  await page.waitForLoadState("networkidle");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Bot Dashboard", () => {
  test("renders dashboard with stats and bot table", async ({ page }) => {
    await gotoBots(page);

    // Verify header
    await expect(page.locator('[data-testid="bot-dashboard-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="bot-dashboard-header"]').getByRole("heading")).toBeVisible();
    await expect(page.locator('[data-testid="btn-create-bot"]')).toBeVisible();

    // Verify stats cards
    await expect(page.locator('[data-testid="bot-stats-grid"]')).toBeVisible();
    await expect(page.getByText("Total Bots")).toBeVisible();
    await expect(page.getByText("Messages (MTD)")).toBeVisible();
    await expect(page.getByText("Cost (MTD)")).toBeVisible();

    // Verify bot rows
    await expect(page.getByText("Support Agent")).toBeVisible();
    await expect(page.getByText("Sales Bot")).toBeVisible();
    await expect(page.getByText("Dev Helper")).toBeVisible();

    // Verify status badges
    await expect(page.locator('[data-testid="bot-row-bot-001"]').getByText("running")).toBeVisible();
    await expect(page.locator('[data-testid="bot-row-bot-002"]').getByText("stopped")).toBeVisible();
    await expect(page.locator('[data-testid="bot-row-bot-003"]').getByText("provisioning")).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/01-bot-dashboard.png`,
      fullPage: true,
    });
  });

  test("empty state when no bots", async ({ page }) => {
    await gotoBots(page, { "bots.list": () => [] });

    await expect(page.locator('[data-testid="bot-empty-state"]')).toBeVisible();
    await expect(page.getByText("No bots yet")).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/02-bot-empty-state.png`,
      fullPage: true,
    });
  });
});

test.describe("Bot Create Dialog", () => {
  test("opens create dialog and fills form", async ({ page }) => {
    await gotoBots(page);

    // Open create dialog
    await page.click('[data-testid="btn-create-bot"]');
    await expect(page.getByRole("heading", { name: "Create Bot" })).toBeVisible();
    await expect(page.getByText("Configure your new bot instance")).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/03-bot-create-dialog-empty.png`,
    });

    // Fill name
    await page.fill('[data-testid="bot-create-name"]', "E2E Test Bot");

    // Select a channel checkbox
    const discordCheckbox = page.locator("label").filter({ hasText: "discord" });
    await discordCheckbox.click();

    // Select a model checkbox
    const claudeCheckbox = page.locator("label").filter({ hasText: "claude-opus-4-6" });
    await claudeCheckbox.click();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/04-bot-create-dialog-filled.png`,
    });

    // Click Review
    await page.click('[data-testid="btn-review-bot"]');
    await expect(page.getByText("Review & Confirm")).toBeVisible();
    await expect(page.getByText("E2E Test Bot")).toBeVisible();
    await expect(page.getByText("Estimated Monthly Cost")).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/05-bot-create-review.png`,
    });
  });
});

test.describe("Bot Detail View", () => {
  test("shows bot detail with overview tab", async ({ page }) => {
    await gotoBots(page);

    // Click first bot row
    await page.getByText("Support Agent").click();
    await expect(page.locator('[data-testid="bot-detail-view"]')).toBeVisible();

    // Verify bot name and status
    await expect(
      page.locator('[data-testid="bot-detail-view"]').getByText("Support Agent"),
    ).toBeVisible();

    // Verify overview tab content
    await expect(page.getByText("Memory Usage")).toBeVisible();
    await expect(page.getByText("Messages (MTD)")).toBeVisible();
    await expect(page.getByText("Tokens (MTD)")).toBeVisible();
    await expect(page.getByText("Configuration")).toBeVisible();
    await expect(page.getByText("bot-001")).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/06-bot-detail-overview.png`,
      fullPage: true,
    });
  });

  test("shows channels tab", async ({ page }) => {
    await gotoBots(page);
    await page.getByText("Support Agent").click();

    await page.getByRole("tab", { name: /Channels/ }).click();
    await expect(page.getByText("Connected Channels")).toBeVisible();
    await expect(page.locator('[data-testid="bot-detail-view"]').getByText("discord")).toBeVisible();
    await expect(page.locator('[data-testid="bot-detail-view"]').getByText("telegram")).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/07-bot-detail-channels.png`,
      fullPage: true,
    });
  });

  test("shows logs tab", async ({ page }) => {
    await gotoBots(page);
    await page.getByText("Support Agent").click();

    await page.getByRole("tab", { name: /Logs/ }).click();
    await expect(page.getByText("Recent Logs")).toBeVisible();
    await expect(page.getByText("Gateway started on port 18789")).toBeVisible();
    await expect(page.getByText("Rate limit approaching")).toBeVisible();
    await expect(page.getByText("Webhook delivery failed")).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/08-bot-detail-logs.png`,
      fullPage: true,
    });
  });

  test("shows billing tab with payment methods and invoices", async ({ page }) => {
    await gotoBots(page);
    await page.getByText("Support Agent").click();

    await page.getByRole("tab", { name: /Billing/ }).click();

    await expect(page.getByText("Current Plan")).toBeVisible();
    await expect(page.getByText("Payment Methods")).toBeVisible();
    await expect(page.getByText("Visa ending in 4242")).toBeVisible();
    await expect(page.getByText("ETH Wallet")).toBeVisible();
    await expect(page.getByText("Add Card")).toBeVisible();
    await expect(page.getByText("Pay with Crypto")).toBeVisible();
    await expect(page.getByRole("button", { name: "Wire Transfer" })).toBeVisible();

    await expect(page.getByText("Usage This Month")).toBeVisible();
    await expect(page.getByText("Invoice History")).toBeVisible();
    await expect(page.getByText("Cloud plan - February 2026")).toBeVisible();
    await expect(page.getByText("Credits & Balance")).toBeVisible();
    await expect(page.getByText("$42.50", { exact: true })).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/09-bot-detail-billing.png`,
      fullPage: true,
    });
  });

  test("shows settings tab", async ({ page }) => {
    await gotoBots(page);
    await page.getByText("Support Agent").click();

    await page.getByRole("tab", { name: /Settings/ }).click();
    await expect(page.getByText("Bot Settings")).toBeVisible();
    await expect(page.getByText("Auto-restart")).toBeVisible();
    await expect(page.getByText("Health Check Interval")).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/10-bot-detail-settings.png`,
      fullPage: true,
    });
  });

  test("back button returns to dashboard", async ({ page }) => {
    await gotoBots(page);
    await page.getByText("Support Agent").click();

    await expect(page.locator('[data-testid="bot-detail-view"]')).toBeVisible();

    await page.click('[data-testid="btn-back-to-dashboard"]');
    await expect(page.locator('[data-testid="bot-dashboard-header"]')).toBeVisible();
  });
});

test.describe("Bot Actions", () => {
  test("dropdown menu shows correct actions for running bot", async ({ page }) => {
    await gotoBots(page);

    // Open dropdown for running bot (Support Agent)
    const row = page.locator('[data-testid="bot-row-bot-001"]');
    const menuButton = row.locator('button:has(span.sr-only:text("Open menu"))');
    await menuButton.click();

    // Running bot should show Stop, Restart, Delete
    await expect(page.getByRole("menuitem", { name: "Stop" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Restart" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/11-bot-actions-running.png`,
    });
  });

  test("dropdown menu shows correct actions for stopped bot", async ({ page }) => {
    await gotoBots(page);

    // Open dropdown for stopped bot (Sales Bot)
    const row = page.locator('[data-testid="bot-row-bot-002"]');
    const menuButton = row.locator('button:has(span.sr-only:text("Open menu"))');
    await menuButton.click();

    // Stopped bot should show Start, Delete (not Stop/Restart)
    await expect(page.getByRole("menuitem", { name: "Start" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/12-bot-actions-stopped.png`,
    });
  });
});
