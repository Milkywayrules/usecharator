import { opentelemetry } from "@elysiajs/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { Elysia } from "elysia";
import type { AppConfig } from "../config";

const TRAILING_SLASH_RE = /\/$/;

export function isOtelEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  return Boolean(endpoint);
}

function normalizeTraceExporterUrl(endpoint: string): string {
  const trimmed = endpoint.replace(TRAILING_SLASH_RE, "");
  return trimmed.endsWith("/v1/traces") ? trimmed : `${trimmed}/v1/traces`;
}

export function otelPlugin(config: AppConfig) {
  if (!config.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return new Elysia({ name: "otel-disabled" });
  }

  const traceUrl = normalizeTraceExporterUrl(
    config.OTEL_EXPORTER_OTLP_ENDPOINT
  );

  return opentelemetry({
    instrumentations: [],
    serviceName: config.OTEL_SERVICE_NAME,
    spanProcessors: [
      new BatchSpanProcessor(new OTLPTraceExporter({ url: traceUrl })),
    ],
  });
}
