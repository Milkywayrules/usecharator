import { describe, expect, test } from "bun:test";
import type { generationJobs, telegramLinkCodes } from "@charator/db";
import {
  generateLinkCode,
  isLinkCodeValid,
  parseStartCommand,
  shouldNotifyTelegram,
  validateTelegramWebhookSecret,
} from "./telegram";

const BASE32_CODE_RE = /^[A-Z2-7]{8}$/;

describe("telegram link codes", () => {
  test("generateLinkCode returns 8 base32 characters", () => {
    const code = generateLinkCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(BASE32_CODE_RE);
  });

  test("isLinkCodeValid rejects used or expired codes", () => {
    const row: Pick<
      typeof telegramLinkCodes.$inferSelect,
      "expiresAt" | "usedAt"
    > = {
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    };
    expect(isLinkCodeValid(row)).toBe(true);

    expect(isLinkCodeValid({ ...row, usedAt: new Date() })).toBe(false);
    expect(
      isLinkCodeValid({
        ...row,
        expiresAt: new Date(Date.now() - 1),
      })
    ).toBe(false);
  });
});

describe("telegram webhook helpers", () => {
  test("validateTelegramWebhookSecret requires configured secret", () => {
    expect(validateTelegramWebhookSecret("secret", "secret", true)).toBe(true);
    expect(validateTelegramWebhookSecret("wrong", "secret", true)).toBe(false);
    expect(validateTelegramWebhookSecret("secret", undefined, true)).toBe(
      false
    );
    expect(validateTelegramWebhookSecret("secret", "secret", false)).toBe(
      false
    );
  });

  test("parseStartCommand extracts link code", () => {
    expect(parseStartCommand("/start ABC12345")).toBe("ABC12345");
    expect(parseStartCommand("/start@MyBot XYZ98765")).toBe("XYZ98765");
    expect(parseStartCommand("/start")).toBeNull();
    expect(parseStartCommand("hello")).toBeNull();
  });
});

describe("telegram notify gating", () => {
  const terminalJob: Pick<
    typeof generationJobs.$inferSelect,
    "status" | "userId"
  > = {
    status: "succeeded",
    userId: "user-1",
  };

  test("skips anonymous, unlinked, disabled, or non-terminal jobs", () => {
    expect(
      shouldNotifyTelegram({
        featureEnabled: true,
        job: { ...terminalJob, userId: null },
        link: {
          notifyTelegram: true,
          telegramChatId: "123",
        },
      })
    ).toBe(false);

    expect(
      shouldNotifyTelegram({
        featureEnabled: false,
        job: terminalJob,
        link: {
          notifyTelegram: true,
          telegramChatId: "123",
        },
      })
    ).toBe(false);

    expect(
      shouldNotifyTelegram({
        featureEnabled: true,
        job: terminalJob,
        link: null,
      })
    ).toBe(false);

    expect(
      shouldNotifyTelegram({
        featureEnabled: true,
        job: terminalJob,
        link: {
          notifyTelegram: false,
          telegramChatId: "123",
        },
      })
    ).toBe(false);

    expect(
      shouldNotifyTelegram({
        featureEnabled: true,
        job: { ...terminalJob, status: "running" },
        link: {
          notifyTelegram: true,
          telegramChatId: "123",
        },
      })
    ).toBe(false);
  });

  test("allows linked users with notifications enabled", () => {
    expect(
      shouldNotifyTelegram({
        featureEnabled: true,
        job: terminalJob,
        link: {
          notifyTelegram: true,
          telegramChatId: "123",
        },
      })
    ).toBe(true);

    expect(
      shouldNotifyTelegram({
        featureEnabled: true,
        job: { ...terminalJob, status: "failed" },
        link: {
          notifyTelegram: true,
          telegramChatId: "123",
        },
      })
    ).toBe(true);
  });
});

describe("telegram deep links", () => {
  test("buildDeepLink encodes start parameter", async () => {
    const { buildDeepLink } = await import("./telegram");
    expect(buildDeepLink("CharatorBot", "ABCD2345")).toBe(
      "https://t.me/CharatorBot?start=ABCD2345"
    );
  });
});
