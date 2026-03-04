import { defineConfig } from "@playwright/test";

// In CI with output: "standalone", `next start` does not work.
// Use the standalone server directly instead.
// Playwright runs commands in a shell already, so no sh -c wrapper needed.
const ciCommand =
  'WEB_SERVER=$(find .next/standalone -name "server.js" -path "*/web/server.js" -not -path "*/node_modules/*" | head -1) && HOSTNAME=0.0.0.0 PORT=3000 NEXT_MANUAL_SIG_HANDLE=true node $WEB_SERVER';

export default defineConfig({
  timeout: 180000, // test timeout 180s (3 minutes)
  expect: {
    timeout: 60000, // assertion timeout 60s (increased for CI)
  },
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:3000",
    actionTimeout: 30000, // 30s click/fill timeout (CI runners are slow)
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "default",
      testDir: "./src/__e2e__",
      testIgnore: /bots\.spec\.ts/,
    },
    {
      name: "bots",
      testDir: "./src/__e2e__",
      testMatch: /bots\.spec\.ts/,
      use: {
        screenshot: "on", // always capture screenshots for bot tests
      },
    },
  ],
  webServer: {
    command: process.env.CI ? ciCommand : "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes for server startup in CI
    stdout: "ignore",
    stderr: "pipe",
  },
});
