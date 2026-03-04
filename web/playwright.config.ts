import { defineConfig } from "@playwright/test";

// In CI with output: "standalone", `next start` does not work.
// Use the standalone server directly instead.
// The standalone output does NOT include static assets or public files —
// they must be copied into the standalone tree before the server starts.
// See: https://nextjs.org/docs/pages/api-reference/config/next-config-js/output#automatically-copying-traced-files
const ciCommand = [
  // Find the standalone server entrypoint
  'WEB_SERVER=$(find .next/standalone -name "server.js" -path "*/web/server.js" -not -path "*/node_modules/*" | head -1)',
  // Derive the standalone web root (e.g. .next/standalone/web)
  "STANDALONE_WEB_DIR=$(dirname $WEB_SERVER)",
  // Copy static assets (JS/CSS bundles) so the browser can load them
  "cp -r .next/static $STANDALONE_WEB_DIR/.next/static",
  // Copy public directory (favicon, images, etc.)
  "cp -r public $STANDALONE_WEB_DIR/public 2>/dev/null || true",
  // Copy .env files so getServerSideProps can read env at runtime
  "cp ../.env $STANDALONE_WEB_DIR/../.env 2>/dev/null || true",
  "cp .env $STANDALONE_WEB_DIR/.env 2>/dev/null || true",
  // Start the standalone server from the standalone root (CWD matters for .env loading)
  // Use basename — after cd, the original relative $STANDALONE_WEB_DIR path would double up
  "cd $STANDALONE_WEB_DIR/.. && HOSTNAME=0.0.0.0 PORT=3000 NEXT_MANUAL_SIG_HANDLE=true node $(basename $STANDALONE_WEB_DIR)/server.js",
].join(" && ");

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
    stdout: "pipe",
    stderr: "pipe",
  },
});
