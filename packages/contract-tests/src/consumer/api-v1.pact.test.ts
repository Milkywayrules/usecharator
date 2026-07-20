import { describe, expect, test } from "bun:test";
import { MatchersV3, PactV3 } from "@pact-foundation/pact";
import { PACT_CONSUMER, PACT_DIR, PACT_PROVIDER } from "../pact-config";

const { eachLike, like } = MatchersV3;

const provider = new PactV3({
  consumer: PACT_CONSUMER,
  dir: PACT_DIR,
  logLevel: "warn",
  provider: PACT_PROVIDER,
});

describe("charator public v1 API contracts", () => {
  test("GET /api/health returns ok payload", async () => {
    provider
      .given("api is healthy")
      .uponReceiving("a health check request")
      .withRequest({
        headers: {
          Accept: "application/json",
        },
        method: "GET",
        path: "/api/health",
      })
      .willRespondWith({
        body: {
          status: like("ok"),
        },
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/api/health`, {
        headers: { Accept: "application/json" },
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string };
      expect(body.status).toBe("ok");
    });
  });

  test("GET /api/v1/themes returns theme list with ids", async () => {
    provider
      .given("themes catalog is available")
      .uponReceiving("a themes list request")
      .withRequest({
        headers: {
          Accept: "application/json",
        },
        method: "GET",
        path: "/api/v1/themes",
      })
      .willRespondWith({
        body: eachLike({
          description: like("Anime character themes"),
          id: like("anime"),
          label: like("Anime"),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/api/v1/themes`, {
        headers: { Accept: "application/json" },
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as Array<{ id: string }>;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0]?.id).toBeTruthy();
    });
  });

  test("GET /api/v1/providers/capabilities returns providers and presets", async () => {
    provider
      .given("provider capabilities are configured")
      .uponReceiving("a provider capabilities request")
      .withRequest({
        headers: {
          Accept: "application/json",
        },
        method: "GET",
        path: "/api/v1/providers/capabilities",
      })
      .willRespondWith({
        body: {
          presets: eachLike({
            id: like("anime-fast"),
            label: like("Anime fast"),
          }),
          providers: eachLike({
            label: like("OpenRouter"),
            provider: like("openrouter"),
          }),
        },
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(
        `${mockServer.url}/api/v1/providers/capabilities`,
        {
          headers: { Accept: "application/json" },
        }
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        presets: unknown[];
        providers: unknown[];
      };
      expect(Array.isArray(body.providers)).toBe(true);
      expect(Array.isArray(body.presets)).toBe(true);
    });
  });

  test("GET /api/v1/gallery returns paginated items array", async () => {
    provider
      .given("gallery listing is available")
      .uponReceiving("a gallery list request")
      .withRequest({
        headers: {
          Accept: "application/json",
        },
        method: "GET",
        path: "/api/v1/gallery",
      })
      .willRespondWith({
        body: {
          hasMore: like(false),
          items: like([]),
          nextOffset: like(0),
        },
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/api/v1/gallery`, {
        headers: { Accept: "application/json" },
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        hasMore: boolean;
        items: unknown[];
        nextOffset: number;
      };
      expect(Array.isArray(body.items)).toBe(true);
      expect(typeof body.hasMore).toBe("boolean");
      expect(typeof body.nextOffset).toBe("number");
    });
  });

  test("GET /api/v1/generations/nonexistent returns ApiError 404", async () => {
    const missingJobId = "11111111-1111-4111-8111-111111111111";

    provider
      .given("generation job does not exist")
      .uponReceiving("a generation lookup for a missing job")
      .withRequest({
        headers: {
          Accept: "application/json",
        },
        method: "GET",
        path: `/api/v1/generations/${missingJobId}`,
      })
      .willRespondWith({
        body: {
          code: like("not_found"),
          message: like("job not found"),
        },
        headers: {
          "Content-Type": "application/json",
        },
        status: 404,
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(
        `${mockServer.url}/api/v1/generations/${missingJobId}`,
        {
          headers: { Accept: "application/json" },
        }
      );
      expect(response.status).toBe(404);
      const body = (await response.json()) as { code: string; message: string };
      expect(body.code).toBe("not_found");
      expect(body.message).toBeTruthy();
    });
  });
});
