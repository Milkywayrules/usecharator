import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearToken,
  configPath,
  DEFAULT_API_URL,
  resolveConfig,
  saveToken,
} from "../src/config";

const originalEnv = { ...process.env };
const originalHome = process.env.HOME;

describe("resolveConfig precedence", () => {
  let tempHome = "";

  beforeEach(() => {
    tempHome = join(tmpdir(), `charator-cli-test-${Date.now()}`);
    mkdirSync(join(tempHome, ".config", "charator"), { recursive: true });
    process.env.HOME = tempHome;
    process.env.CHARATOR_API_URL = "";
    process.env.CHARATOR_API_TOKEN = "";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (originalHome) {
      process.env.HOME = originalHome;
    }
    rmSync(tempHome, { force: true, recursive: true });
  });

  test("defaults api url when nothing configured", () => {
    const resolved = resolveConfig();
    expect(resolved.apiUrl).toBe(DEFAULT_API_URL);
    expect(resolved.token).toBeUndefined();
  });

  test("flags beat env and file", () => {
    writeFileSync(
      join(tempHome, ".config", "charator", "config.json"),
      JSON.stringify({ apiUrl: "http://file", token: "ct_live_file" })
    );
    process.env.CHARATOR_API_URL = "http://env";
    process.env.CHARATOR_API_TOKEN = "ct_live_env";

    const resolved = resolveConfig({
      apiUrl: "http://flag",
      token: "ct_live_flag",
    });
    expect(resolved.apiUrl).toBe("http://flag");
    expect(resolved.token).toBe("ct_live_flag");
  });

  test("env beats file", () => {
    writeFileSync(
      join(tempHome, ".config", "charator", "config.json"),
      JSON.stringify({ apiUrl: "http://file", token: "ct_live_file" })
    );
    process.env.CHARATOR_API_URL = "http://env";
    process.env.CHARATOR_API_TOKEN = "ct_live_env";

    const resolved = resolveConfig();
    expect(resolved.apiUrl).toBe("http://env");
    expect(resolved.token).toBe("ct_live_env");
  });

  test("save and clear token in config file", () => {
    saveToken("ct_live_saved", "http://localhost:3999");
    const fromFile = resolveConfig();
    expect(fromFile.token).toBe("ct_live_saved");
    expect(fromFile.apiUrl).toBe("http://localhost:3999");
    clearToken();
    expect(resolveConfig().token).toBeUndefined();
    expect(configPath().includes(".config/charator/config.json")).toBe(true);
  });
});
