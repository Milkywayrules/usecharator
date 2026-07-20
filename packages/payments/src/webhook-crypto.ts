import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_TOLERANCE_SECONDS = 300;

export class WebhookSignatureError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "WebhookSignatureError";
  }
}

function parseSignatureHeader(header: string): {
  timestamp: number;
  v1: string;
} {
  const parts = header.split(",");
  let timestamp: number | undefined;
  let v1: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t" && value) {
      timestamp = Number(value);
    }
    if (key === "v1" && value) {
      v1 = value;
    }
  }

  if (!(timestamp && v1 && Number.isFinite(timestamp))) {
    throw new WebhookSignatureError("invalid signature header");
  }

  return { timestamp, v1 };
}

export function signWebhookPayload(
  secret: string,
  payload: string,
  timestamp = Math.floor(Date.now() / 1000)
): string {
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

export function verifyWebhookPayload(
  secret: string,
  rawBody: string,
  signatureHeader: string
): void {
  const { timestamp, v1 } = parseSignatureHeader(signatureHeader);
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > SIGNATURE_TOLERANCE_SECONDS) {
    throw new WebhookSignatureError("signature timestamp outside tolerance");
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(v1, "hex");
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new WebhookSignatureError("signature mismatch");
  }
}
