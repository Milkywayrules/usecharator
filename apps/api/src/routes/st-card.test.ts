import { describe, expect, test } from "bun:test";
import { MAX_ST_CARD_PNG_BYTES } from "@charator/spec";
import { HttpError } from "../lib/errors";
import { handleStCardImport } from "./st-card";

describe("st-card import body limits", () => {
  test("rejects oversized JSON body via Content-Length", async () => {
    const request = new Request("http://localhost/api/v1/spec/import/st-card", {
      body: '{"card":{}}',
      headers: {
        "Content-Length": String(MAX_ST_CARD_PNG_BYTES + 1),
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    await expect(handleStCardImport(request)).rejects.toMatchObject({
      body: { code: "payload_too_large" },
      status: 413,
    });
  });

  test("rejects oversized JSON body from actual payload size", async () => {
    const oversized = JSON.stringify({
      card: { data: "x".repeat(MAX_ST_CARD_PNG_BYTES) },
    });
    const request = new Request("http://localhost/api/v1/spec/import/st-card", {
      body: oversized,
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    try {
      await handleStCardImport(request);
      throw new Error("expected HttpError");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      const httpError = error as HttpError;
      expect(httpError.status).toBe(413);
      expect(httpError.body.code).toBe("payload_too_large");
    }
  });
});
