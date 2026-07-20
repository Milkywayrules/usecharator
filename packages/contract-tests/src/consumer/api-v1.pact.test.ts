import { describe, expect, test } from "bun:test";
import { createEmptySpec } from "@charator/spec";
import { MatchersV3, PactV3 } from "@pact-foundation/pact";
import { PACT_CONSUMER, PACT_DIR, PACT_PROVIDER } from "../pact-config";

const { eachLike, like } = MatchersV3;

const provider = new PactV3({
  consumer: PACT_CONSUMER,
  dir: PACT_DIR,
  logLevel: "warn",
  provider: PACT_PROVIDER,
});

const minimalRenderSpec = createEmptySpec({
  meta: { ...createEmptySpec().meta, name: "Pact fixture" },
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

  test("GET /api/v1/spec/catalog returns section metadata", async () => {
    provider
      .given("spec catalog is available")
      .uponReceiving("a spec catalog request")
      .withRequest({
        headers: {
          Accept: "application/json",
        },
        method: "GET",
        path: "/api/v1/spec/catalog",
      })
      .willRespondWith({
        body: {
          corePaths: eachLike(like("control.mode")),
          fieldCatalog: eachLike({
            description: like("global strictness"),
            kind: like("enum"),
            label: like("mode"),
            path: like("control.mode"),
            tier: like("core"),
          }),
          sectionTitles: like({
            appearance: like("Appearance"),
            archetype: like("Archetype"),
            art: like("Art direction"),
            framing: like("Framing"),
            identity: like("Identity"),
            magic: like("Magic"),
            outfit: like("Outfit"),
            personality: like("Personality"),
            pose: like("Pose"),
            props: like("Props"),
            setting: like("Setting"),
          }),
        },
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/api/v1/spec/catalog`, {
        headers: { Accept: "application/json" },
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        corePaths: unknown[];
        fieldCatalog: unknown[];
        sectionTitles: Record<string, string>;
      };
      expect(Array.isArray(body.corePaths)).toBe(true);
      expect(Array.isArray(body.fieldCatalog)).toBe(true);
      expect(body.sectionTitles.appearance).toBeTruthy();
    });
  });

  test("GET /api/v1/me/entitlements returns ApiError 401 without auth", async () => {
    provider
      .given("user is not authenticated")
      .uponReceiving("an entitlements request without credentials")
      .withRequest({
        headers: {
          Accept: "application/json",
        },
        method: "GET",
        path: "/api/v1/me/entitlements",
      })
      .willRespondWith({
        body: {
          code: like("unauthorized"),
          message: like("sign in required"),
        },
        headers: {
          "Content-Type": "application/json",
        },
        status: 401,
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/api/v1/me/entitlements`, {
        headers: { Accept: "application/json" },
      });
      expect(response.status).toBe(401);
      const body = (await response.json()) as { code: string; message: string };
      expect(body.code).toBe("unauthorized");
      expect(body.message).toBeTruthy();
    });
  });

  test("POST /api/v1/spec/render returns prompt for minimal spec", async () => {
    const requestBody = JSON.stringify({ spec: minimalRenderSpec });

    provider
      .given("spec render accepts minimal body")
      .uponReceiving("a spec render request with minimal spec")
      .withRequest({
        body: requestBody,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
        path: "/api/v1/spec/render",
      })
      .willRespondWith({
        body: {
          prompt: like("character illustration prompt"),
        },
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/api/v1/spec/render`, {
        body: requestBody,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { prompt: string };
      expect(body.prompt.length).toBeGreaterThan(0);
    });
  });
});
