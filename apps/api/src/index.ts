import { Elysia } from "elysia";
import { auth } from "./auth";
import { config, telegramConfigured } from "./config";
import { errorResponse, HttpError } from "./lib/errors";
import { v1OpenApi } from "./openapi";
import { handleBillingWebhookPost } from "./routes/billing";
import {
  handleFalWebhook,
  handleReplicateWebhook,
  startJobMaintenanceLoop,
} from "./routes/handlers";
import {
  LEGACY_ROUTE_PREFIX,
  mountProgrammaticRoutes,
  V1_ROUTE_PREFIX,
} from "./routes/register";
import {
  handleTelegramLinkCodePost,
  handleTelegramLinkDelete,
  handleTelegramLinkGet,
  handleTelegramLinkPatch,
  handleTelegramWebhook,
} from "./routes/telegram";

async function dispatch(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    if (error instanceof HttpError) {
      return Response.json(error.body, { status: error.status });
    }
    return errorResponse(error);
  }
}

const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok" }))
  .all("/auth/*", ({ request }) => auth.handler(request))
  .use((router) =>
    mountProgrammaticRoutes(
      router as unknown as Elysia,
      LEGACY_ROUTE_PREFIX,
      dispatch
    )
  )
  .group(V1_ROUTE_PREFIX, (group) =>
    group.use(v1OpenApi).use((router) =>
      mountProgrammaticRoutes(router as unknown as Elysia, "", dispatch, {
        includeOpenApiDetail: true,
        includeV1OnlyRoutes: true,
        openApiPathPrefix: V1_ROUTE_PREFIX,
      })
    )
  )
  .post("/webhooks/fal", ({ request }) =>
    dispatch(() => handleFalWebhook(request))
  )
  .post("/webhooks/replicate", ({ request }) =>
    dispatch(() => handleReplicateWebhook(request))
  )
  .post("/webhooks/telegram", ({ request }) =>
    dispatch(() => handleTelegramWebhook(request))
  )
  .post("/billing/webhook", ({ request }) =>
    dispatch(() => handleBillingWebhookPost(request))
  )
  .post("/telegram/link-code", ({ request }) =>
    dispatch(() => handleTelegramLinkCodePost(request))
  )
  .get("/telegram/link", ({ request }) =>
    dispatch(() => handleTelegramLinkGet(request))
  )
  .patch("/telegram/link", ({ request }) =>
    dispatch(() => handleTelegramLinkPatch(request))
  )
  .delete("/telegram/link", ({ request }) =>
    dispatch(() => handleTelegramLinkDelete(request))
  )
  .listen(config.PORT);

startJobMaintenanceLoop();

if (!config.FAL_WEBHOOK_SECRET) {
  console.warn(
    "fal webhooks disabled without FAL_WEBHOOK_SECRET; using poll fallback"
  );
}
if (!config.REPLICATE_WEBHOOK_SECRET) {
  console.warn(
    "replicate webhooks disabled without REPLICATE_WEBHOOK_SECRET; using poll fallback"
  );
}
if (!telegramConfigured(config)) {
  console.warn(
    "telegram notifications disabled without TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET"
  );
}

console.log(`api listening on http://localhost:${app.server?.port}/api/health`);

export type App = typeof app;
