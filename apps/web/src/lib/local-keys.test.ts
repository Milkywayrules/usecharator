import { expect, test } from "bun:test";
import {
  clearLocalKey,
  getLocalKey,
  maskApiKey,
  readLocalKeys,
  setLocalKey,
  writeLocalKeys,
} from "./local-keys";

const storage = new Map<string, string>();

globalThis.localStorage = {
  clear: () => storage.clear(),
  getItem: (key) => storage.get(key) ?? null,
  key: (index) => [...storage.keys()][index] ?? null,
  get length() {
    return storage.size;
  },
  removeItem: (key) => storage.delete(key),
  setItem: (key, value) => storage.set(key, value),
} as Storage;

test("local keys round-trip", () => {
  writeLocalKeys({});
  setLocalKey("openai", "sk-test-key-12345678");
  expect(getLocalKey("openai")).toBe("sk-test-key-12345678");
  expect(readLocalKeys().openai?.apiKey).toBe("sk-test-key-12345678");
  clearLocalKey("openai");
  expect(getLocalKey("openai")).toBeUndefined();
});

test("maskApiKey hides middle segment", () => {
  expect(maskApiKey("sk-abcdefghijklmnop")).toBe("sk-a••••mnop");
  expect(maskApiKey("short")).toBe("••••••••");
});
