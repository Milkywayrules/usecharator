import path from "node:path";

export const PACT_CONSUMER = "charator-web";
export const PACT_PROVIDER = "charator-api";
export const PACT_FILE = `${PACT_CONSUMER}-${PACT_PROVIDER}.json`;

export const PACT_DIR = path.resolve(import.meta.dir, "../pacts");

export function providerBaseUrl(): string {
  return process.env.API_URL ?? "http://127.0.0.1:3001";
}

export function shouldRunProviderVerification(): boolean {
  return process.env.PACT_PROVIDER_VERIFY === "1";
}
