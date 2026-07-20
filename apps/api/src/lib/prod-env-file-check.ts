import {
  DEV_PAYMENT_WEBHOOK_SECRET,
  getProductionStopViolations,
  type ProductionGuardConfig,
} from "./startup-guards";

const ENV_FILE_LINE_SPLIT = /\r?\n/u;

/** Parse `KEY=value` lines from a dotenv-style file (no variable expansion). */
export function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const rawLine of content.split(ENV_FILE_LINE_SPLIT)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

export function productionGuardFromEnv(
  env: Record<string, string | undefined>
): ProductionGuardConfig {
  return {
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? "",
    BETTER_AUTH_URL: env.BETTER_AUTH_URL ?? "",
    DATABASE_URL: env.DATABASE_URL ?? "",
    FAL_WEBHOOK_SECRET: env.FAL_WEBHOOK_SECRET,
    GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET,
    KEY_ENCRYPTION_MASTER_KEY: env.KEY_ENCRYPTION_MASTER_KEY ?? "",
    MOCK_BILLING_ENABLED: env.MOCK_BILLING_ENABLED as
      | "true"
      | "false"
      | undefined,
    NODE_ENV:
      (env.NODE_ENV as ProductionGuardConfig["NODE_ENV"]) ?? "production",
    OTEL_EXPORTER_OTLP_ENDPOINT: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    PAYMENT_WEBHOOK_SECRET:
      env.PAYMENT_WEBHOOK_SECRET ?? DEV_PAYMENT_WEBHOOK_SECRET,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
    R2_BUCKET: env.R2_BUCKET,
    R2_ENDPOINT: env.R2_ENDPOINT,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    REPLICATE_WEBHOOK_SECRET: env.REPLICATE_WEBHOOK_SECRET,
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: env.TELEGRAM_WEBHOOK_SECRET,
  };
}

/** Returns missing STOP keys for `NODE_ENV=production`; empty when ready. */
export function validateProductionStopKeys(
  env: Record<string, string | undefined>
): string[] {
  const nodeEnv = env.NODE_ENV ?? "production";
  if (nodeEnv !== "production") {
    return ["NODE_ENV must be production for prod boot check"];
  }

  return getProductionStopViolations(productionGuardFromEnv(env));
}
