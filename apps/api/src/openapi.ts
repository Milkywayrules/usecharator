import { openapi } from "@elysiajs/openapi";

export const v1OpenApi = openapi({
  documentation: {
    components: {
      securitySchemes: {
        bearerAuth: {
          bearerFormat: "ct_live_…",
          scheme: "bearer",
          type: "http",
        },
        sessionCookie: {
          description: "Better Auth session cookie from GitHub OAuth sign-in.",
          in: "cookie",
          name: "better-auth.session_token",
          type: "apiKey",
        },
      },
    },
    info: {
      description:
        "Programmatic Chara Tor API. Bearer tokens work on resource routes; token management requires a browser session.",
      title: "Chara Tor Public API",
      version: "1.0.0",
    },
    tags: [
      { description: "Async image generation jobs", name: "generations" },
      { description: "Saved character specs", name: "characters" },
      { description: "Public character gallery", name: "gallery" },
      { description: "Encrypted provider keys", name: "keys" },
      {
        description: "Session-only API token management",
        name: "tokens",
      },
      {
        description: "Theme catalog and spec metadata for programmatic clients",
        name: "spec",
      },
    ],
  },
  path: "/docs",
  specPath: "/docs/json",
});
