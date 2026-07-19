import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function toolText(data: unknown, summary?: string): CallToolResult {
  const text =
    summary ??
    (typeof data === "string" ? data : JSON.stringify(data, null, 2));
  return {
    content: [{ text, type: "text" }],
  };
}

export function toolError(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ text: message, type: "text" }],
    isError: true,
  };
}
