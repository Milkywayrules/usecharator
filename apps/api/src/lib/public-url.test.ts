import { describe, expect, test } from "bun:test";
import { assertPublicHttpsUrl } from "./public-url";

describe("assertPublicHttpsUrl", () => {
  test("rejects non-https schemes", async () => {
    await expect(
      assertPublicHttpsUrl("http://example.com/image.png")
    ).rejects.toThrow("url must use https");
  });

  test("rejects loopback hostnames", async () => {
    await expect(
      assertPublicHttpsUrl("https://127.0.0.1/internal")
    ).rejects.toThrow("url host is not public");
  });

  test("rejects hostnames that resolve to private addresses", async () => {
    await expect(
      assertPublicHttpsUrl("https://localhost/image.png")
    ).rejects.toThrow("url host resolves to a private address");
  });

  test("allows public https hostnames", async () => {
    await expect(
      assertPublicHttpsUrl("https://example.com/image.png")
    ).resolves.toBeUndefined();
  });
});
