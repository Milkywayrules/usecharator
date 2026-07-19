import { readFile } from "node:fs/promises";
import type { CommandDef } from "citty";
import { type ResolvedConfig, resolveConfig } from "./config";

export interface GlobalArgs {
  "api-url"?: string;
  json?: boolean;
  token?: string;
}

export function globalArgDefs() {
  return {
    "api-url": {
      description: "Charator API base URL (default http://localhost:3001)",
      type: "string" as const,
    },
    json: {
      default: false,
      description: "Emit raw JSON output",
      type: "boolean" as const,
    },
    token: {
      description: "Bearer API token (ct_live_...)",
      type: "string" as const,
    },
  };
}

export function loadRuntime(args: Record<string, unknown>): {
  clientConfig: ResolvedConfig;
  json: boolean;
} {
  const clientConfig = resolveConfig({
    apiUrl: typeof args["api-url"] === "string" ? args["api-url"] : undefined,
    token: typeof args.token === "string" ? args.token : undefined,
  });
  return { clientConfig, json: Boolean(args.json) };
}

export function argString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function withGlobalArgs<T extends CommandDef>(command: T): T {
  return {
    ...command,
    args: {
      ...globalArgDefs(),
      ...(command.args ?? {}),
    },
  } as T;
}

export async function readJsonFile(path: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    throw new Error(`file not found: ${path}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "parse error";
    throw new Error(`invalid JSON in ${path}: ${message}`);
  }
}
