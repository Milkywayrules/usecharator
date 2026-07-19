import { Elysia } from "elysia";
import { auth } from "./auth";
import { config } from "./config";
import { errorResponse, HttpError } from "./lib/errors";
import {
  handleCharactersDelete,
  handleCharactersList,
  handleCharactersPatch,
  handleCharactersPost,
  handleFalWebhook,
  handleGenerationGet,
  handleGenerationsPost,
  handleKeysDelete,
  handleKeysList,
  handleKeysPost,
  handleReplicateWebhook,
  startJobMaintenanceLoop,
} from "./routes/handlers";
import { handleGalleryDetail, handleGalleryList } from "./routes/gallery";

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
  .post("/generations", ({ request }) =>
    dispatch(() => handleGenerationsPost(request))
  )
  .get("/generations/:id", ({ request, params }) =>
    dispatch(() => handleGenerationGet(request, params.id))
  )
  .get("/characters", ({ request }) =>
    dispatch(() => handleCharactersList(request))
  )
  .post("/characters", ({ request }) =>
    dispatch(() => handleCharactersPost(request))
  )
  .patch("/characters/:id", ({ request, params }) =>
    dispatch(() => handleCharactersPatch(request, params.id))
  )
  .delete("/characters/:id", ({ request, params }) =>
    dispatch(() => handleCharactersDelete(request, params.id))
  )
  .get("/gallery", ({ request }) => dispatch(() => handleGalleryList(request)))
  .get("/gallery/:id", ({ request, params }) =>
    dispatch(() => handleGalleryDetail(request, params.id))
  )
  .get("/keys", ({ request }) => dispatch(() => handleKeysList(request)))
  .post("/keys", ({ request }) => dispatch(() => handleKeysPost(request)))
  .delete("/keys/:id", ({ request, params }) =>
    dispatch(() => handleKeysDelete(request, params.id))
  )
  .post("/webhooks/fal", ({ request }) =>
    dispatch(() => handleFalWebhook(request))
  )
  .post("/webhooks/replicate", ({ request }) =>
    dispatch(() => handleReplicateWebhook(request))
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

console.log(`api listening on http://localhost:${app.server?.port}/api/health`);

export type App = typeof app;
