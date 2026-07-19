import pc from "picocolors";
import { ApiClientError } from "./client";

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log("(empty)");
    return;
  }
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? "").length))
  );
  const line = widths.map((width) => "-".repeat(width)).join("  ");
  console.log(
    headers.map((header, i) => header.padEnd(widths[i] ?? 0)).join("  ")
  );
  console.log(line);
  for (const row of rows) {
    console.log(
      row.map((cell, i) => (cell ?? "").padEnd(widths[i] ?? 0)).join("  ")
    );
  }
}

export function printError(error: unknown, json: boolean): never {
  if (json) {
    if (error instanceof ApiClientError) {
      printJson({ code: error.apiError.code, message: error.apiError.message });
    } else if (error instanceof Error) {
      printJson({ code: "cli_error", message: error.message });
    } else {
      printJson({ code: "cli_error", message: String(error) });
    }
    process.exit(1);
  }

  if (error instanceof ApiClientError) {
    console.error(
      pc.red(`error [${error.apiError.code}]: ${error.apiError.message}`)
    );
    if (error.status === 401 || error.apiError.code === "unauthorized") {
      console.error(
        pc.dim("hint: run `charator auth login` or set CHARATOR_API_TOKEN")
      );
    }
  } else if (error instanceof Error) {
    console.error(pc.red(`error: ${error.message}`));
  } else {
    console.error(pc.red(`error: ${String(error)}`));
  }
  process.exit(1);
}

export function printLines(lines: string[]): void {
  for (const line of lines) {
    console.log(line);
  }
}
