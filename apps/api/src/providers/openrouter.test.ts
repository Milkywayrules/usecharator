import { describe, expect, test } from "bun:test";
import {
  generateOpenRouterImage,
  shouldFallbackOpenRouterToChat,
} from "./openrouter";

describe("openrouter adapter routing", () => {
  test("shouldFallbackOpenRouterToChat covers client errors", () => {
    expect(shouldFallbackOpenRouterToChat(404)).toBe(true);
    expect(shouldFallbackOpenRouterToChat(400)).toBe(true);
    expect(shouldFallbackOpenRouterToChat(422)).toBe(true);
    expect(shouldFallbackOpenRouterToChat(500)).toBe(false);
  });

  test("non-image-api models use chat path without calling images endpoint", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = ((input) => {
      calls.push(String(input));
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  images: [
                    {
                      image_url: {
                        url: "data:image/png;base64,QUJDRA==",
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        )
      );
    }) as typeof fetch;

    try {
      const result = await generateOpenRouterImage({
        apiKey: "test-key",
        model: "unknown/model",
        prompt: "test prompt",
      });
      expect(result.kind).toBe("sync");
      expect(result.images.length).toBe(1);
      expect(calls).toEqual([expect.stringContaining("/chat/completions")]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("image-api models prefer dedicated endpoint with chat fallback", async () => {
    const originalFetch = globalThis.fetch;
    let imageAttempts = 0;
    globalThis.fetch = ((input) => {
      const url = String(input);
      if (url.includes("/images")) {
        imageAttempts += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ error: { message: "nope" } }), {
            status: 404,
          })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  images: [
                    {
                      image_url: {
                        url: "data:image/png;base64,QUJDRA==",
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        )
      );
    }) as typeof fetch;

    try {
      const result = await generateOpenRouterImage({
        apiKey: "test-key",
        aspectRatio: "16:9",
        model: "google/gemini-2.5-flash-image",
        prompt: "test prompt",
      });
      expect(imageAttempts).toBe(1);
      expect(result.images.length).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
