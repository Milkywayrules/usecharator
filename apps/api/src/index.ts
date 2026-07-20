import { createApp } from "./app";
import { config, telegramConfigured } from "./config";
import { logApiWarn } from "./lib/logger";
import { startJobMaintenanceLoop } from "./routes/handlers";

const app = createApp(config).listen(config.PORT);

startJobMaintenanceLoop();

if (!config.FAL_WEBHOOK_SECRET) {
  logApiWarn(
    "api.startup",
    "fal webhooks disabled without FAL_WEBHOOK_SECRET; using poll fallback"
  );
}
if (!config.REPLICATE_WEBHOOK_SECRET) {
  logApiWarn(
    "api.startup",
    "replicate webhooks disabled without REPLICATE_WEBHOOK_SECRET; using poll fallback"
  );
}
if (!telegramConfigured(config)) {
  logApiWarn(
    "api.startup",
    "telegram notifications disabled without TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET"
  );
}

console.log(`api listening on http://localhost:${app.server?.port}/api/health`);

export type App = typeof app;
