export function redactSecrets(message: string): string {
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/Key\s+\S+/gi, "Key [redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/r8_[A-Za-z0-9]+/g, "[redacted]");
}
