import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function encryptSecret(
  plaintext: string,
  masterKeyBase64: string
): string {
  const key = Buffer.from(masterKeyBase64, "base64");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(
  payloadBase64: string,
  masterKeyBase64: string
): string {
  const key = Buffer.from(masterKeyBase64, "base64");
  const payload = Buffer.from(payloadBase64, "base64");
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function hashReporterIp(ip: string, masterKeyBase64: string): string {
  const key = Buffer.from(masterKeyBase64, "base64");
  return createHmac("sha256", key).update(ip, "utf8").digest("hex");
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "****";
  }
  return `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
}
