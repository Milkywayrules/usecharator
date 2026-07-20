import type { ApiError, TierLimitError } from "@charator/shared";

export class HttpError extends Error {
  readonly status: number;
  readonly body: ApiError | TierLimitError;

  constructor(status: number, body: ApiError | TierLimitError) {
    super(body.message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(error.body, { status: error.status });
  }
  console.error(error);
  return Response.json(
    { code: "internal_error", message: "unexpected server error" },
    { status: 500 }
  );
}

export function redactSecrets(message: string): string {
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/Key\s+\S+/gi, "Key [redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/r8_[A-Za-z0-9]+/g, "[redacted]");
}
