import { describe, expect, test } from "bun:test";
import { ApiClient, ApiClientError, type FetchImpl } from "../src/client";
import { DEFAULT_API_URL } from "../src/config";
import { printError } from "../src/output";

describe("themes command handler", () => {
  test("lists themes from mocked API", async () => {
    const fetchImpl: FetchImpl = async (input) => {
      expect(String(input)).toBe(`${DEFAULT_API_URL}/api/v1/themes`);
      return new Response(
        JSON.stringify([
          {
            description: "Cel-shaded look",
            id: "anime",
            label: "Anime",
          },
        ]),
        { status: 200 }
      );
    };

    const client = new ApiClient(
      { apiUrl: DEFAULT_API_URL, configPath: "" },
      fetchImpl
    );
    const themes = await client.request<
      { description: string; id: string; label: string }[]
    >({ path: "/themes" });

    expect(themes).toHaveLength(1);
    expect(themes[0]?.id).toBe("anime");
  });
});

describe("error rendering", () => {
  test("ApiClientError carries API code", () => {
    const error = new ApiClientError(401, {
      code: "unauthorized",
      message: "invalid token",
    });
    expect(error.apiError.code).toBe("unauthorized");
    expect(error.message).toBe("invalid token");
  });

  test("printError exits with code 1", () => {
    const originalExit = process.exit;
    let code = 0;
    process.exit = ((value?: number) => {
      code = value ?? 0;
      throw new Error("exit");
    }) as typeof process.exit;

    try {
      expect(() =>
        printError(
          new ApiClientError(400, {
            code: "validation_error",
            message: "bad input",
          }),
          false
        )
      ).toThrow("exit");
      expect(code).toBe(1);
    } finally {
      process.exit = originalExit;
    }
  });
});
