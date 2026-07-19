import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
});

export const config = envSchema.parse(process.env);
