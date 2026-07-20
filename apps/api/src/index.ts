import { createApp } from "./app";
import { config, telegramConfigured } from "./config";
import { logApiWarn } from "./lib/logger";
import {
  assertProductionReady,
  getProductionWarnMissing,
} from "./lib/startup-guards";
import { startJobMaintenanceLoop } from "./routes/handlers";

assertProductionReady(config);

const app = createApp(config).listen(config.PORT);

startJobMaintenanceLoop();

for (const key of getProductionWarnMissing(config)) {
  if (key === "FAL_WEBHOOK_SECRET") {
    logApiWarn(
      "api.startup",
      "fal webhooks disabled without FAL_WEBHOOK_SECRET; using poll fallback"
    );
  } else if (key === "REPLICATE_WEBHOOK_SECRET") {
    logApiWarn(
      "api.startup",
      "replicate webhooks disabled without REPLICATE_WEBHOOK_SECRET; using poll fallback"
    );
  } else if (key === "OTEL_EXPORTER_OTLP_ENDPOINT") {
    logApiWarn(
      "api.startup",
      "opentelemetry export disabled without OTEL_EXPORTER_OTLP_ENDPOINT"
    );
  }
}

if (!telegramConfigured(config)) {
  logApiWarn(
    "api.startup",
    "telegram notifications disabled without TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET"
  );
}

console.log(`api listening on http://localhost:${app.server?.port}/api/health`);

export type App = typeof app;
