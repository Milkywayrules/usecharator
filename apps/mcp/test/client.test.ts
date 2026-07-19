import { describe, expect, test } from "bun:test";
import {
  CharatorApiError,
  CharatorClient,
  normalizeFetchError,
} from "../src/client.js";
import { listThemes } from "../src/tools.js";

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
