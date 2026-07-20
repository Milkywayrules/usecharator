import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/** Dev-only default; must not be used when `NODE_ENV` is production. */
export const DEV_PAYMENT_WEBHOOK_SECRET = "dev-payment-webhook-secret";

const base64KeySchema = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      return Buffer.from(value, "base64").length === 32;
    } catch {
      return false;
    }
  }, "must decode to 32 bytes");

const server = {
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  FAL_WEBHOOK_SECRET: z.string().optional(),
  GENERATION_JOB_TIMEOUT_MS: z.coerce.number().default(300_000),
  GENERATION_POLL_INTERVAL_MS: z.coerce.number().default(15_000),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  KEY_ENCRYPTION_MASTER_KEY: base64KeySchema,
  MOCK_BILLING_ENABLED: z.enum(["true", "false"]).optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default("charator-api"),
  PAYMENT_PROVIDER: z.string().default("mock"),
  PAYMENT_WEBHOOK_SECRET: z.string().default(DEV_PAYMENT_WEBHOOK_SECRET),
  PORT: z.coerce.number().default(3001),
  PRESIGNED_URL_TTL_SECONDS: z.coerce.number().default(900),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  RATE_LIMIT_ANONYMOUS_PER_HOUR: z.coerce.number().default(10),
  RATE_LIMIT_AUTHENTICATED_PER_HOUR: z.coerce.number().default(60),
  REPLICATE_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  WEB_APP_URL: z.string().url().default("http://localhost:3000"),
} as const;

function assertProductionSecrets(cfg: {
  NODE_ENV: "development" | "production" | "test";
  PAYMENT_WEBHOOK_SECRET: string;
}): void {
  if (cfg.NODE_ENV !== "production") {
    return;
  }

  if (
    !cfg.PAYMENT_WEBHOOK_SECRET ||
    cfg.PAYMENT_WEBHOOK_SECRET === DEV_PAYMENT_WEBHOOK_SECRET
  ) {
    throw new Error(
      "PAYMENT_WEBHOOK_SECRET must be set to a strong non-default value when NODE_ENV is production"
    );
  }
}

function buildEnv(runtimeEnv: Record<string, string | undefined>) {
  const parsed = createEnv({
    emptyStringAsUndefined: true,
    runtimeEnv,
    server,
  });
  assertProductionSecrets(parsed);
  return parsed;
}

export type AppConfig = ReturnType<typeof buildEnv>;

export function parseAppConfig(
  runtimeEnv: Record<string, string | undefined> = process.env
): AppConfig {
  return buildEnv(runtimeEnv);
}

/** Validated runtime environment for the API process. */
export const env = buildEnv(process.env);

/** @deprecated Prefer `env` — kept for existing imports. */
export const config = env;

export function githubConfigured(cfg: AppConfig): boolean {
  return Boolean(cfg.GITHUB_CLIENT_ID && cfg.GITHUB_CLIENT_SECRET);
}

export function r2Configured(cfg: AppConfig): boolean {
  return Boolean(
    cfg.R2_BUCKET &&
      cfg.R2_ACCESS_KEY_ID &&
      cfg.R2_SECRET_ACCESS_KEY &&
      (cfg.R2_ENDPOINT || cfg.R2_ACCOUNT_ID)
  );
}

export function r2Endpoint(cfg: AppConfig): string {
  if (cfg.R2_ENDPOINT) {
    return cfg.R2_ENDPOINT;
  }
  if (cfg.R2_ACCOUNT_ID) {
    return `https://${cfg.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }
  throw new Error("R2 endpoint not configured");
}

export function telegramConfigured(cfg: AppConfig): boolean {
  return Boolean(cfg.TELEGRAM_BOT_TOKEN && cfg.TELEGRAM_WEBHOOK_SECRET);
}

export function mockBillingEnabled(cfg: AppConfig): boolean {
  if (cfg.MOCK_BILLING_ENABLED === "true") {
    return true;
  }
  if (cfg.MOCK_BILLING_ENABLED === "false") {
    return false;
  }
  return cfg.NODE_ENV !== "production";
}
