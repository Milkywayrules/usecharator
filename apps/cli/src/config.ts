import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_API_URL = "http://localhost:3001";
const TRAILING_SLASHES = /\/+$/;

export interface CharatorConfigFile {
  apiUrl?: string;
  token?: string;
}

export interface ResolvedConfig {
  apiUrl: string;
  configPath: string;
  token?: string;
}

function userHome(): string {
  return process.env.HOME?.trim() || homedir();
}

function configDir(): string {
  return join(userHome(), ".config", "charator");
}

export function configPath(): string {
  return join(configDir(), "config.json");
}

function readConfigFile(): CharatorConfigFile {
  const path = configPath();
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as CharatorConfigFile;
  } catch {
    return {};
  }
}

export function resolveConfig(options?: {
  apiUrl?: string;
  token?: string;
}): ResolvedConfig {
  const file = readConfigFile();
  const apiUrl =
    options?.apiUrl?.trim() ||
    process.env.CHARATOR_API_URL?.trim() ||
    file.apiUrl?.trim() ||
    DEFAULT_API_URL;
  const token =
    options?.token?.trim() ||
    process.env.CHARATOR_API_TOKEN?.trim() ||
    file.token?.trim() ||
    undefined;

  return {
    apiUrl: apiUrl.replace(TRAILING_SLASHES, ""),
    configPath: configPath(),
    token,
  };
}

export function saveToken(token: string, apiUrl?: string): void {
  const existing = readConfigFile();
  const dir = configDir();
  mkdirSync(dir, { mode: 0o700, recursive: true });
  const path = configPath();
  const next: CharatorConfigFile = {
    ...existing,
    token: token.trim(),
    ...(apiUrl ? { apiUrl: apiUrl.replace(TRAILING_SLASHES, "") } : {}),
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodSync(path, 0o600);
}

export function clearToken(): void {
  const existing = readConfigFile();
  const path = configPath();
  if (!existsSync(path)) {
    return;
  }
  const { token: _removed, ...rest } = existing;
  if (Object.keys(rest).length === 0) {
    writeFileSync(path, "{}\n", { encoding: "utf8", mode: 0o600 });
  } else {
    writeFileSync(path, `${JSON.stringify(rest, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
  chmodSync(path, 0o600);
}

export function apiBase(config: ResolvedConfig): string {
  return `${config.apiUrl}/api/v1`;
}

/** @internal test hook */
export function resetConfigCacheForTests(): void {
  // config is read fresh each call — no cache
}
