import { Elysia } from "elysia";
import { config } from "./config";

const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok" }))
  .listen(config.PORT);

console.log(`api listening on http://localhost:${app.server?.port}/api/health`);

export type App = typeof app;
