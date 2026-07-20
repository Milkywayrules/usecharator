import { openapi } from "@elysiajs/openapi";

const tierIdEnum = ["free", "plus", "pro", "studio"] as const;

export const v1OpenApi = openapi({
  documentation: {
    components: {
      schemas: {
        ApiError: {
          properties: {
            code: { type: "string" },
            message: { type: "string" },
          },
          required: ["code", "message"],
          type: "object",
        },
        TierLimitError: {
          properties: {
            code: { enum: ["tier_limit"], type: "string" },
            current: { minimum: 0, type: "integer" },
            limit: { type: "string" },
            message: { type: "string" },
            tier: { enum: [...tierIdEnum], type: "string" },
            upgradeTier: {
              enum: [...tierIdEnum],
              nullable: true,
              type: "string",
            },
          },
          required: ["code", "message", "limit", "tier", "current", "upgradeTier"],
          type: "object",
        },
      },
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
        "Programmatic Chara Tor API. Bearer tokens work on resource routes; token management requires a browser session. These docs are intentionally public (no auth gate) for discoverability; responses include X-Robots-Tag: noindex. Success responses return bare JSON resource bodies. Errors return `{ code, message }`; tier limit violations add `{ limit, tier, current, upgradeTier }` with code `tier_limit`.",
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
      {
        description: "Provider capability descriptors and generation presets",
        name: "providers",
      },
    ],
  },
  path: "/docs",
  specPath: "/docs/json",
});
