import { defineConfig, devices } from "@playwright/test";

const API_PORT = 3001;
const WEB_PORT = 3000;
const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;
const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;

/** CI dummy secrets — same values as integration job; no real Postgres required. */
const apiEnv: Record<string, string> = {
  BETTER_AUTH_SECRET: "ci-only-dummy-better-auth-secret-012345678901",
  BETTER_AUTH_URL: API_ORIGIN,
  DATABASE_URL: "postgresql://charator:charator@127.0.0.1:5432/charator",
  GITHUB_CLIENT_ID: "ci-dummy-github-client-id",
  GITHUB_CLIENT_SECRET: "ci-dummy-github-client-secret",
  KEY_ENCRYPTION_MASTER_KEY: "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=",
  MOCK_BILLING_ENABLED: "true",
  NODE_ENV: "test",
  PAYMENT_PROVIDER: "mock",
  PAYMENT_WEBHOOK_SECRET: "ci-test-payment-webhook-secret",
  PORT: String(API_PORT),
  WEB_APP_URL: WEB_ORIGIN,
};

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  outputDir: "../test-results",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "../playwright-report" }],
      ]
    : [
        ["list"],
        ["html", { open: "never", outputFolder: "../playwright-report" }],
      ],
  retries: process.env.CI ? 2 : 0,
  testDir: "./specs",
  timeout: 60_000,
  use: {
    baseURL: WEB_ORIGIN,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "bun src/index.ts",
      cwd: "../apps/api",
      env: apiEnv,
      reuseExistingServer: false,
      stderr: "pipe",
      stdout: "pipe",
      timeout: 120_000,
      url: `${API_ORIGIN}/api/health`,
    },
    {
      command: process.env.CI
        ? "bun run start:e2e"
        : "E2E=1 bun run build && E2E=1 bun run start:e2e",
      cwd: "../apps/web",
      env: {
        ...process.env,
        API_URL: API_ORIGIN,
        E2E: "1",
        HOSTNAME: "127.0.0.1",
        NEXT_PUBLIC_API_URL: API_ORIGIN,
        NODE_ENV: "production",
        PORT: String(WEB_PORT),
      },
      reuseExistingServer: false,
      stderr: "pipe",
      stdout: "pipe",
      timeout: 300_000,
      url: WEB_ORIGIN,
    },
  ],
  workers: 1,
});
