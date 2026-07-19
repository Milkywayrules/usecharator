import { z } from "zod";

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

const envSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  FAL_WEBHOOK_SECRET: z.string().optional(),
  GENERATION_JOB_TIMEOUT_MS: z.coerce.number().default(300_000),
  GENERATION_POLL_INTERVAL_MS: z.coerce.number().default(15_000),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  KEY_ENCRYPTION_MASTER_KEY: base64KeySchema,
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
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
});

export type AppConfig = z.infer<typeof envSchema>;

export const config: AppConfig = envSchema.parse(process.env);

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
