import { z } from "zod";

const configSchema = z.object({
  CHARATOR_API_TOKEN: z.string().min(1).optional(),
  CHARATOR_API_URL: z.string().url().default("https://charator.dioilham.com"),
});

export type McpConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  return configSchema.parse(env);
}

export const AUTH_REQUIRED_MESSAGE =
  "authentication required — set CHARATOR_API_TOKEN to a bearer token from Chara Tor web settings (ct_live_...)";
