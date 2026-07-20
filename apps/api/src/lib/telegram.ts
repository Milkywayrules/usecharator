import type { Db, sheetBatches, telegramLinkCodes } from "@charator/db";
import { characters, generationJobs, telegramLinks } from "@charator/db";
import { eq } from "drizzle-orm";
import { config, r2Configured, telegramConfigured } from "../config";
import { logApiError } from "./logger";
import { presignedGetUrl } from "./r2";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const LINK_CODE_LENGTH = 8;
const LINK_CODE_TTL_MS = 10 * 60 * 1000;
const GENERATE_JOB_URL = "https://charator.dioilham.com/generate";
const SHEET_BATCH_URL = "https://charator.dioilham.com/sheets";
const START_COMMAND_RE = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/i;

let cachedBotUsername: string | null = null;
let botUsernamePromise: Promise<string | null> | null = null;

export type TelegramFetch = typeof fetch;

let telegramFetch: TelegramFetch = fetch;

export function setTelegramFetch(next: TelegramFetch): void {
  telegramFetch = next;
}

export function resetTelegramFetch(): void {
  telegramFetch = fetch;
}

export function generateLinkCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LINK_CODE_LENGTH));
  let code = "";
  for (const byte of bytes) {
    code += BASE32_ALPHABET[byte % BASE32_ALPHABET.length];
  }
  return code;
}

export function linkCodeExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + LINK_CODE_TTL_MS);
}

export function isLinkCodeValid(
  row: Pick<typeof telegramLinkCodes.$inferSelect, "expiresAt" | "usedAt">,
  now = new Date()
): boolean {
  if (row.usedAt) {
    return false;
  }
  return row.expiresAt > now;
}

export function validateTelegramWebhookSecret(
  header: string | null,
  secret: string | undefined,
  featureEnabled: boolean
): boolean {
  if (!featureEnabled) {
    return false;
  }
  if (!secret) {
    return false;
  }
  return header === secret;
}

export function parseStartCommand(text: string | undefined): string | null {
  if (!text) {
    return null;
  }
  const match = START_COMMAND_RE.exec(text.trim());
  return match?.[1] ?? null;
}

export interface NotifyGateInput {
  featureEnabled: boolean;
  job: Pick<typeof generationJobs.$inferSelect, "status" | "userId">;
  link: Pick<
    typeof telegramLinks.$inferSelect,
    "notifyTelegram" | "telegramChatId"
  > | null;
}

export function shouldNotifyTelegram(input: NotifyGateInput): boolean {
  if (!input.featureEnabled) {
    return false;
  }
  if (!input.job.userId) {
    return false;
  }
  if (!input.link) {
    return false;
  }
  if (!input.link.notifyTelegram) {
    return false;
  }
  return input.job.status === "succeeded" || input.job.status === "failed";
}

export function getBotUsername(): Promise<string | null> {
  if (config.TELEGRAM_BOT_USERNAME) {
    return Promise.resolve(config.TELEGRAM_BOT_USERNAME);
  }
  if (cachedBotUsername) {
    return Promise.resolve(cachedBotUsername);
  }
  if (!telegramConfigured(config)) {
    return Promise.resolve(null);
  }
  if (!botUsernamePromise) {
    botUsernamePromise = fetchBotUsername().finally(() => {
      botUsernamePromise = null;
    });
  }
  return botUsernamePromise;
}

async function fetchBotUsername(): Promise<string | null> {
  try {
    const response = await telegramApi<{ username?: string }>("getMe");
    if (response.ok && response.result?.username) {
      cachedBotUsername = response.result.username;
      return cachedBotUsername;
    }
  } catch (error) {
    logApiError("telegram.getMe", error);
  }
  return null;
}

export function buildDeepLink(botUsername: string, code: string): string {
  return `https://t.me/${botUsername}?start=${encodeURIComponent(code)}`;
}

async function telegramApi<T>(
  method: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; result?: T }> {
  if (!config.TELEGRAM_BOT_TOKEN) {
    throw new Error("telegram bot token not configured");
  }

  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/${method}`;
  const response = await telegramFetch(url, {
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    method: "POST",
  });

  return (await response.json()) as { ok: boolean; result?: T };
}

export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<void> {
  const response = await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
  });
  if (!response.ok) {
    throw new Error("telegram sendMessage failed");
  }
}

export async function sendTelegramPhoto(
  chatId: string,
  photoUrl: string,
  caption: string
): Promise<void> {
  const response = await telegramApi("sendPhoto", {
    caption,
    chat_id: chatId,
    photo: photoUrl,
  });
  if (!response.ok) {
    throw new Error("telegram sendPhoto failed");
  }
}

async function characterNameForJob(
  db: Db,
  characterId: string | null
): Promise<string | null> {
  if (!characterId) {
    return null;
  }

  const [character] = await db
    .select({ name: characters.name })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  return character?.name ?? null;
}

function jobCaption(
  job: typeof generationJobs.$inferSelect,
  characterName: string | null
): string {
  const parts = [
    characterName ? `Character: ${characterName}` : null,
    `Job: ${job.id}`,
    `View: ${GENERATE_JOB_URL}/${job.id}`,
  ].filter(Boolean);
  return parts.join("\n");
}

export async function notifyJobFinished(
  db: Db,
  job: typeof generationJobs.$inferSelect
): Promise<void> {
  if (!telegramConfigured(config)) {
    return;
  }

  if (!job.userId) {
    return;
  }

  const [link] = await db
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.userId, job.userId))
    .limit(1);

  if (!(link && shouldNotifyTelegram({ featureEnabled: true, job, link }))) {
    return;
  }

  const chatId = link.telegramChatId;

  try {
    if (job.status === "failed") {
      await sendTelegramMessage(
        chatId,
        `Generation failed\n\n${job.error ?? "unknown error"}\n\n${GENERATE_JOB_URL}/${job.id}`
      );
      return;
    }

    if (job.status !== "succeeded" || job.imageKeys.length === 0) {
      return;
    }

    if (!r2Configured(config)) {
      await sendTelegramMessage(
        chatId,
        `Generation succeeded but image storage is unavailable.\n\n${GENERATE_JOB_URL}/${job.id}`
      );
      return;
    }

    const [firstImageKey] = job.imageKeys;
    if (!firstImageKey) {
      return;
    }

    const photoUrl = presignedGetUrl(firstImageKey);
    const characterName = await characterNameForJob(db, job.characterId);
    await sendTelegramPhoto(chatId, photoUrl, jobCaption(job, characterName));
  } catch (error) {
    logApiError("telegram.notify", error, { jobId: job.id });
  }
}

function sheetBatchCaption(
  batch: typeof sheetBatches.$inferSelect,
  characterName: string | null,
  succeededCount: number,
  totalCount: number
): string {
  const parts = [
    characterName ? `Character: ${characterName}` : null,
    `Sheet: ${batch.preset} (${succeededCount}/${totalCount})`,
    `Status: ${batch.status}`,
    `View: ${SHEET_BATCH_URL}/${batch.id}`,
  ].filter(Boolean);
  return parts.join("\n");
}

export async function notifySheetBatchFinished(
  db: Db,
  batch: typeof sheetBatches.$inferSelect
): Promise<void> {
  if (!telegramConfigured(config)) {
    return;
  }

  if (!batch.userId) {
    return;
  }

  const [link] = await db
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.userId, batch.userId))
    .limit(1);

  const gateJob = {
    status:
      batch.status === "failed" ? ("failed" as const) : ("succeeded" as const),
    userId: batch.userId,
  };

  if (
    !(
      link && shouldNotifyTelegram({ featureEnabled: true, job: gateJob, link })
    )
  ) {
    return;
  }

  const members = await db
    .select({
      imageKeys: generationJobs.imageKeys,
      status: generationJobs.status,
    })
    .from(generationJobs)
    .where(eq(generationJobs.sheetBatchId, batch.id));

  const succeeded = members.filter((member) => member.status === "succeeded");
  const characterName = await characterNameForJob(db, batch.characterId);
  const chatId = link.telegramChatId;

  try {
    if (batch.status === "failed") {
      await sendTelegramMessage(
        chatId,
        `Sheet batch failed\n\n${sheetBatchCaption(batch, characterName, 0, batch.totalCount)}`
      );
      return;
    }

    const previewJob = succeeded.find((member) => member.imageKeys.length > 0);
    const caption = sheetBatchCaption(
      batch,
      characterName,
      succeeded.length,
      batch.totalCount
    );

    if (!(previewJob && r2Configured(config))) {
      await sendTelegramMessage(chatId, `Sheet batch finished\n\n${caption}`);
      return;
    }

    const [firstKey] = previewJob.imageKeys;
    if (!firstKey) {
      await sendTelegramMessage(chatId, `Sheet batch finished\n\n${caption}`);
      return;
    }

    await sendTelegramPhoto(chatId, presignedGetUrl(firstKey), caption);
  } catch (error) {
    logApiError("telegram.batch", error, { batchId: batch.id });
  }
}

export function resetTelegramCacheForTests(): void {
  cachedBotUsername = null;
  botUsernamePromise = null;
}
