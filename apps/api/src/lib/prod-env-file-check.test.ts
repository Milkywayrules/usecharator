import { describe, expect, test } from "bun:test";
import {
  parseEnvFile,
  productionGuardFromEnv,
  validateProductionStopKeys,
} from "./prod-env-file-check";
import { getProductionStopViolations } from "./startup-guards";

const prodEnv = {
  BETTER_AUTH_SECRET: "01234567890123456789012345678901",
  BETTER_AUTH_URL: "https://charator.dioilham.com",
  DATABASE_URL: "postgresql://charator:secret@postgres:5432/charator",
  GITHUB_CLIENT_ID: "gh-id",
  GITHUB_CLIENT_SECRET: "gh-secret",
  KEY_ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 1).toString("base64"),
  MOCK_BILLING_ENABLED: "false",
  NODE_ENV: "production",
  PAYMENT_WEBHOOK_SECRET: "prod-webhook-secret-with-enough-entropy",
  R2_ACCESS_KEY_ID: "access",
  R2_ACCOUNT_ID: "acct",
  R2_BUCKET: "charator-prod",
  R2_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
  R2_SECRET_ACCESS_KEY: "secret",
};

describe("parseEnvFile", () => {
  test("skips comments and blank lines", () => {
    expect(
      parseEnvFile(`
# comment
NODE_ENV=production

DATABASE_URL=postgresql://x
`)
    ).toEqual({
      DATABASE_URL: "postgresql://x",
      NODE_ENV: "production",
    });
  });

  test("strips surrounding quotes", () => {
    expect(parseEnvFile('BETTER_AUTH_URL="https://example.com"')).toEqual({
      BETTER_AUTH_URL: "https://example.com",
    });
  });
});

describe("validateProductionStopKeys", () => {
  test("returns empty for a complete production env", () => {
    expect(validateProductionStopKeys(prodEnv)).toEqual([]);
  });

  test("rejects non-production NODE_ENV", () => {
    expect(
      validateProductionStopKeys({ ...prodEnv, NODE_ENV: "development" })
    ).toEqual(["NODE_ENV must be production for prod boot check"]);
  });

  test("lists missing STOP keys", () => {
    const missing = validateProductionStopKeys({
      NODE_ENV: "production",
    });
    expect(missing).toContain("DATABASE_URL");
    expect(missing).toContain("GITHUB_CLIENT_ID");
    expect(missing).toContain("R2_BUCKET");
  });

  test("matches startup-guards for parsed env file content", () => {
    const parsed = parseEnvFile(
      Object.entries(prodEnv)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n")
    );
    expect(validateProductionStopKeys(parsed)).toEqual([]);
    expect(
      getProductionStopViolations(productionGuardFromEnv(parsed))
    ).toEqual([]);
  });
});
