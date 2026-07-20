import { Elysia } from "elysia";
import { initLogger, log } from "evlog";
import { evlog, useLogger } from "evlog/elysia";
import type { AppConfig } from "../config";
import { redactSecrets } from "./redact-secrets";

let loggerInitialized = false;

export function initApiLogger(config: AppConfig): void {
  if (loggerInitialized) {
    return;
  }
  loggerInitialized = true;

  initLogger({
    env: {
      environment: config.NODE_ENV,
      service: "charator-api",
    },
    pretty: config.NODE_ENV === "development",
    redact: {
      builtins: ["jwt", "bearer"],
      patterns: [
        /Bearer\s+\S+/gi,
        /Key\s+\S+/gi,
        /sk-[A-Za-z0-9_-]+/g,
        /r8_[A-Za-z0-9]+/g,
      ],
    },
  });
}

export function apiEvlogPlugin() {
  return evlog();
}

export function requestIdResponseHeader() {
  return new Elysia({ name: "request-id-response" }).onAfterHandle(
    { as: "global" },
    ({ set }) => {
      try {
        // biome-ignore lint/correctness/useHookAtTopLevel: evlog useLogger is request-scoped, not React
        const { requestId } = useLogger().getContext() as {
          requestId?: string;
        };
        if (typeof requestId === "string" && requestId.length > 0) {
          set.headers["x-request-id"] = requestId;
        }
      } catch {
        // evlog context unavailable outside instrumented routes
      }
    }
  );
}

export function logApiError(
  scope: string,
  error: unknown,
  fields?: Record<string, unknown>
): void {
  const message =
    error instanceof Error
      ? redactSecrets(error.message)
      : redactSecrets(String(error));
  log.error({ message, tag: scope, ...fields });
}

export function logApiWarn(
  scope: string,
  message: string,
  fields?: Record<string, unknown>
): void {
  log.warn({ message: redactSecrets(message), tag: scope, ...fields });
}
