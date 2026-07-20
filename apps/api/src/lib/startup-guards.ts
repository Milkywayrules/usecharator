/** Dev-only default; must not be used when `NODE_ENV` is production. */
export const DEV_PAYMENT_WEBHOOK_SECRET = "dev-payment-webhook-secret";

export interface ProductionGuardConfig {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  DATABASE_URL: string;
  FAL_WEBHOOK_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  KEY_ENCRYPTION_MASTER_KEY: string;
  MOCK_BILLING_ENABLED?: "true" | "false";
  NODE_ENV: "development" | "production" | "test";
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  PAYMENT_WEBHOOK_SECRET: string;
  R2_ACCESS_KEY_ID?: string;
  R2_ACCOUNT_ID?: string;
  R2_BUCKET?: string;
  R2_ENDPOINT?: string;
  R2_SECRET_ACCESS_KEY?: string;
  REPLICATE_WEBHOOK_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
}

const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_ENDPOINT",
] as const satisfies ReadonlyArray<keyof ProductionGuardConfig>;

/** Hard production requirements — missing any item prevents API boot. */
export function getProductionStopViolations(
  cfg: ProductionGuardConfig
): string[] {
  if (cfg.NODE_ENV !== "production") {
    return [];
  }

  const violations: string[] = [];

  if (!cfg.DATABASE_URL) {
    violations.push("DATABASE_URL");
  }
  if (!cfg.BETTER_AUTH_SECRET) {
    violations.push("BETTER_AUTH_SECRET");
  }
  if (!cfg.BETTER_AUTH_URL) {
    violations.push("BETTER_AUTH_URL");
  }
  if (!cfg.KEY_ENCRYPTION_MASTER_KEY) {
    violations.push("KEY_ENCRYPTION_MASTER_KEY");
  }

  if (
    !cfg.PAYMENT_WEBHOOK_SECRET ||
    cfg.PAYMENT_WEBHOOK_SECRET === DEV_PAYMENT_WEBHOOK_SECRET
  ) {
    violations.push("PAYMENT_WEBHOOK_SECRET");
  }

  if (!cfg.GITHUB_CLIENT_ID) {
    violations.push("GITHUB_CLIENT_ID");
  }
  if (!cfg.GITHUB_CLIENT_SECRET) {
    violations.push("GITHUB_CLIENT_SECRET");
  }

  for (const key of R2_KEYS) {
    if (!cfg[key]) {
      violations.push(key);
    }
  }

  if (cfg.MOCK_BILLING_ENABLED === "true") {
    violations.push("MOCK_BILLING_ENABLED");
  }

  return violations;
}

/** Optional integrations — warn at boot; poll/degrade when unset. */
export function getProductionWarnMissing(cfg: ProductionGuardConfig): string[] {
  if (cfg.NODE_ENV !== "production") {
    return [];
  }

  const missing: string[] = [];

  if (!cfg.FAL_WEBHOOK_SECRET) {
    missing.push("FAL_WEBHOOK_SECRET");
  }
  if (!cfg.REPLICATE_WEBHOOK_SECRET) {
    missing.push("REPLICATE_WEBHOOK_SECRET");
  }
  if (!cfg.TELEGRAM_BOT_TOKEN) {
    missing.push("TELEGRAM_BOT_TOKEN");
  }
  if (!cfg.TELEGRAM_WEBHOOK_SECRET) {
    missing.push("TELEGRAM_WEBHOOK_SECRET");
  }
  if (!cfg.OTEL_EXPORTER_OTLP_ENDPOINT) {
    missing.push("OTEL_EXPORTER_OTLP_ENDPOINT");
  }

  return missing;
}

export function assertProductionReady(cfg: ProductionGuardConfig): void {
  const violations = getProductionStopViolations(cfg);
  if (violations.length === 0) {
    return;
  }

  throw new Error(
    `production startup blocked — configure required env: ${violations.join(", ")}`
  );
}

export function getHealthPayload(cfg: ProductionGuardConfig): {
  status: "ok";
  ready?: boolean;
  missing?: string[];
} {
  if (cfg.NODE_ENV !== "production") {
    return { status: "ok" };
  }

  const missing = getProductionWarnMissing(cfg);
  return {
    ready: true,
    status: "ok",
    ...(missing.length > 0 ? { missing } : {}),
  };
}
