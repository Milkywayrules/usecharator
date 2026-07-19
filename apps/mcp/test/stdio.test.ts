import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import path from "node:path";

const serverEntry = path.join(import.meta.dir, "../src/index.ts");

function sendMessages(
  messages: string[]
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("bun", [serverEntry], {
      env: {
        ...process.env,
        CHARATOR_API_URL: "http://127.0.0.1:9",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr, stdout }));

    for (const message of messages) {
      child.stdin.write(`${message}\n`);
    }
    child.stdin.end();
  });
}

describe("stdio MCP exchange", () => {
  test("initialize and tools/list", async () => {
    const init = JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
        protocolVersion: "2024-11-05",
      },
    });
    const initialized = JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    const listTools = JSON.stringify({
      id: 2,
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
    });

    const { stdout } = await sendMessages([init, initialized, listTools]);
    const lines = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(
        (line) =>
          JSON.parse(line) as {
            id?: number;
            result?: { tools?: { name: string }[] };
          }
      );

    const initResponse = lines.find((line) => line.id === 1);
    expect(initResponse?.result).toBeDefined();

    const toolsResponse = lines.find((line) => line.id === 2);
    const toolNames =
      toolsResponse?.result?.tools?.map((tool) => tool.name) ?? [];
    expect(toolNames).toContain("list_themes");
    expect(toolNames).toContain("generate_image");
    expect(toolNames.length).toBeGreaterThanOrEqual(12);
  });
});
