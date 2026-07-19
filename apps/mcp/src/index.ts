#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CharatorClient } from "./client.js";
import { loadConfig } from "./config.js";
import { registerTools } from "./tools.js";

export function createServer(client: CharatorClient): McpServer {
  const server = new McpServer(
    {
      name: "charator",
      version: "0.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        "Chara Tor MCP server — create and render anime-style character specs, manage your library, and run image generations against the Chara Tor API. Set CHARATOR_API_TOKEN for authenticated tools.",
    }
  );

  registerTools(server, client);
  return server;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new CharatorClient({
    baseUrl: config.CHARATOR_API_URL,
    token: config.CHARATOR_API_TOKEN,
  });

  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
