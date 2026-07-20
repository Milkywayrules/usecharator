import { describe, expect, test } from "bun:test";
import {
  buildProviderCapabilitiesResponse,
  galleryDetailResponseSchema,
  galleryListResponseSchema,
} from "@charator/shared";
import {
  CharatorApiError,
  CharatorClient,
  normalizeFetchError,
} from "../src/client.js";
import {
  browseGallery,
  getGalleryCharacter,
  getProviderCapabilities,
  listThemes,
} from "../src/tools.js";

describe("CharatorClient error normalization", () => {
  test("maps API error JSON to CharatorApiError", async () => {
    const client = new CharatorClient({
      baseUrl: "https://example.test",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ code: "not_found", message: "missing" }),
          {
            headers: { "Content-Type": "application/json" },
            status: 404,
          }
        ),
    });

    await expect(client.request("GET", "/themes")).rejects.toMatchObject({
      code: "not_found",
      message: "not_found: missing",
      status: 404,
    });
  });

  test("maps non-JSON failures", async () => {
    const client = new CharatorClient({
      baseUrl: "https://example.test",
      fetchImpl: async () =>
        new Response("upstream down", {
          status: 502,
        }),
    });

    await expect(client.request("GET", "/themes")).rejects.toMatchObject({
      code: "http_error",
      status: 502,
    });
  });

  test("normalizeFetchError wraps network errors", () => {
    const normalized = normalizeFetchError(new Error("connection refused"));
    expect(normalized).toBeInstanceOf(CharatorApiError);
    expect(normalized.code).toBe("network_error");
  });

  test("auth required without token", async () => {
    const client = new CharatorClient({ baseUrl: "https://example.test" });
    await expect(
      client.request("GET", "/characters", { auth: "required" })
    ).rejects.toMatchObject({ code: "unauthorized", status: 401 });
  });
});

describe("listThemes tool handler", () => {
  test("happy path with mocked fetch", async () => {
    const client = new CharatorClient({
      baseUrl: "https://example.test",
      fetchImpl: (input, init) => {
        expect(String(input)).toBe("https://example.test/api/v1/themes");
        expect(init?.method).toBe("GET");
        return new Response(
          JSON.stringify([
            {
              description: "modern shonen",
              id: "shonen",
              label: "Shonen",
            },
          ]),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          }
        );
      },
    });

    const themes = await listThemes(client);
    expect(themes).toEqual([
      {
        description: "modern shonen",
        id: "shonen",
        label: "Shonen",
      },
    ]);
  });
});

describe("browseGallery tool handler", () => {
  test("forwards q and sort query params", async () => {
    const client = new CharatorClient({
      baseUrl: "https://example.test",
      fetchImpl: (input) => {
        const url = new URL(String(input));
        expect(url.pathname).toBe("/api/v1/gallery");
        expect(url.searchParams.get("q")).toBe("hero");
        expect(url.searchParams.get("sort")).toBe("most_remixed");
        return new Response(
          JSON.stringify(
            galleryListResponseSchema.parse({
              hasMore: false,
              items: [],
              nextOffset: 0,
            })
          ),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          }
        );
      },
    });

    const list = await browseGallery(client, {
      q: "hero",
      sort: "most_remixed",
    });
    expect(list.items).toEqual([]);
  });
});

describe("getGalleryCharacter tool handler", () => {
  test("returns summary fields and caps large specs", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const largeSpec = {
      meta: { name: "Hero" },
      notes: "x".repeat(40_000),
    };
    const detail = galleryDetailResponseSchema.parse({
      createdAt: "2026-01-01T00:00:00.000Z",
      id,
      isOwner: false,
      name: "Hero",
      owner: { displayName: "Artist" },
      remixCount: 2,
      remixedFrom: null,
      renders: ["https://example.test/render.png"],
      spec: largeSpec,
      themeId: "shonen",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    const client = new CharatorClient({
      baseUrl: "https://example.test",
      fetchImpl: (input) => {
        expect(String(input)).toBe(`https://example.test/api/v1/gallery/${id}`);
        return new Response(JSON.stringify(detail), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      },
    });

    const summary = await getGalleryCharacter(client, id);
    expect(summary.id).toBe(id);
    expect(summary.renderCount).toBe(1);
    expect(summary.spec).toEqual({ meta: { name: "Hero" } });
    expect(summary).toMatchObject({ specTruncated: true });
    expect(JSON.stringify(summary).length).toBeLessThan(32_000);
  });
});

describe("getProviderCapabilities tool handler", () => {
  test("returns providers with costEstimate", async () => {
    const payload = buildProviderCapabilitiesResponse();
    const client = new CharatorClient({
      baseUrl: "https://example.test",
      fetchImpl: (input) => {
        expect(String(input)).toBe(
          "https://example.test/api/v1/providers/capabilities"
        );
        return new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      },
    });

    const capabilities = await getProviderCapabilities(client);
    expect(capabilities.providers.length).toBeGreaterThan(0);
    expect(capabilities.presets.length).toBeGreaterThan(0);
    const withCost = capabilities.providers
      .flatMap((provider) => provider.models)
      .find((model) => model.costEstimate !== undefined);
    expect(withCost?.costEstimate?.label).toBeTruthy();
  });
});
