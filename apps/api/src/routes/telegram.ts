import { telegramLinkCodes, telegramLinks } from "@charator/db";
import {
  telegramLinkCodeResponseSchema,
  telegramLinkStatusSchema,
  updateTelegramLinkRequestSchema,
} from "@charator/shared";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, requireSessionUser } from "../auth";
import { config, telegramConfigured } from "../config";
import { HttpError } from "../lib/errors";
import { logApiError } from "../lib/logger";
import {
  buildDeepLink,
  generateLinkCode,
  getBotUsername,
  linkCodeExpiresAt,
  parseStartCommand,
  sendTelegramMessage,
  validateTelegramWebhookSecret,
} from "../lib/telegram";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

function telegramUnavailable(): never {
  throw new HttpError(503, {
    code: "service_unavailable",
    message: "telegram notifications are not configured",
  });
}

export async function handleTelegramLinkCodePost(
  request: Request
): Promise<Response> {
  if (!telegramConfigured(config)) {
    telegramUnavailable();
  }

  const user = await requireSessionUser(request);
  const botUsername = await getBotUsername();
  if (!botUsername) {
    throw new HttpError(503, {
      code: "service_unavailable",
      message: "telegram bot username could not be resolved",
    });
  }

  const code = generateLinkCode();
  await db.insert(telegramLinkCodes).values({
    code,
    expiresAt: linkCodeExpiresAt(),
    userId: user.id,
  });

  const payload = telegramLinkCodeResponseSchema.parse({
    code,
    deepLink: buildDeepLink(botUsername, code),
  });

  return json(payload, 201);
}

export async function handleTelegramLinkGet(
  request: Request
): Promise<Response> {
  const user = await requireSessionUser(request);
  const [link] = await db
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.userId, user.id))
    .limit(1);

  return json(
    telegramLinkStatusSchema.parse({
      linked: Boolean(link),
      notifyTelegram: link?.notifyTelegram ?? true,
      telegramUsername: link?.telegramUsername ?? null,
    })
  );
}

export async function handleTelegramLinkPatch(
  request: Request
): Promise<Response> {
  const user = await requireSessionUser(request);
  const parsed = updateTelegramLinkRequestSchema.safeParse(
    await readJson(request)
  );
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "invalid request",
    });
  }

  const [updated] = await db
    .update(telegramLinks)
    .set({ notifyTelegram: parsed.data.notifyTelegram })
    .where(eq(telegramLinks.userId, user.id))
    .returning();

  if (!updated) {
    throw new HttpError(404, {
      code: "not_found",
      message: "telegram account not linked",
    });
  }

  return json(
    telegramLinkStatusSchema.parse({
      linked: true,
      notifyTelegram: updated.notifyTelegram,
      telegramUsername: updated.telegramUsername,
    })
  );
}

export async function handleTelegramLinkDelete(
  request: Request
): Promise<Response> {
  const user = await requireSessionUser(request);
  const deleted = await db
    .delete(telegramLinks)
    .where(eq(telegramLinks.userId, user.id))
    .returning({ userId: telegramLinks.userId });

  if (deleted.length === 0) {
    throw new HttpError(404, {
      code: "not_found",
      message: "telegram account not linked",
    });
  }

  return new Response(null, { status: 204 });
}

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { username?: string };
    text?: string;
  };
}

export async function handleTelegramWebhook(
  request: Request
): Promise<Response> {
  if (!telegramConfigured(config)) {
    return json({ ok: false }, 503);
  }

  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (
    !validateTelegramWebhookSecret(
      secretHeader,
      config.TELEGRAM_WEBHOOK_SECRET,
      true
    )
  ) {
    return json({ ok: false }, 401);
  }

  const update = (await readJson<TelegramUpdate>(request)).message;
  if (!update) {
    return json({ ok: true });
  }

  const chatId = String(update.chat.id);
  const { text } = update;
  const startCode = parseStartCommand(text);

  if (startCode) {
    const [consumed] = await db
      .update(telegramLinkCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(telegramLinkCodes.code, startCode),
          isNull(telegramLinkCodes.usedAt),
          gt(telegramLinkCodes.expiresAt, new Date())
        )
      )
      .returning({ userId: telegramLinkCodes.userId });

    if (!consumed) {
      await sendTelegramMessage(
        chatId,
        "That link code is invalid or expired. Generate a new one from Chara Tor settings."
      ).catch((error) => logApiError("telegram.reply", error));
      return json({ ok: true });
    }

    await db
      .insert(telegramLinks)
      .values({
        notifyTelegram: true,
        telegramChatId: chatId,
        telegramUsername: update.from?.username ?? null,
        userId: consumed.userId,
      })
      .onConflictDoUpdate({
        set: {
          notifyTelegram: true,
          telegramChatId: chatId,
          telegramUsername: update.from?.username ?? null,
        },
        target: telegramLinks.userId,
      });

    await sendTelegramMessage(
      chatId,
      "Linked! You will receive a DM here when your generation jobs finish."
    ).catch((error) => logApiError("telegram.reply", error));

    return json({ ok: true });
  }

  if (text?.startsWith("/")) {
    await sendTelegramMessage(
      chatId,
      "This bot only sends generation notifications. Manage your link in Chara Tor settings."
    ).catch((error) => logApiError("telegram.reply", error));
  } else if (text) {
    await sendTelegramMessage(
      chatId,
      "This bot only sends generation notifications — no chat commands here."
    ).catch((error) => logApiError("telegram.reply", error));
  }

  return json({ ok: true });
}
