import type { Provider } from "@charator/shared";

const STORAGE_KEY = "charator-byok-keys";

export type LocalKeysStore = Partial<
  Record<Provider, { apiKey: string; customBaseUrl?: string }>
>;

export function readLocalKeys(): LocalKeysStore {
  if (typeof localStorage === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as LocalKeysStore;
    return parsed;
  } catch {
    return {};
  }
}

export function writeLocalKeys(store: LocalKeysStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getLocalKey(provider: Provider): string | undefined {
  return readLocalKeys()[provider]?.apiKey;
}

export function setLocalKey(
  provider: Provider,
  apiKey: string,
  customBaseUrl?: string
): void {
  const store = readLocalKeys();
  store[provider] = { apiKey, ...(customBaseUrl ? { customBaseUrl } : {}) };
  writeLocalKeys(store);
}

export function clearLocalKey(provider: Provider): void {
  const store = readLocalKeys();
  delete store[provider];
  writeLocalKeys(store);
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return "••••••••";
  }
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
