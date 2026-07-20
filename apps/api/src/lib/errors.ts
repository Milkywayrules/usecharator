import type { ApiError, TierLimitError } from "@charator/shared";
import { logApiError } from "./logger";

export class HttpError extends Error {
  readonly status: number;
  readonly body: ApiError | TierLimitError;

  constructor(
    status: number,
    body: ApiError | TierLimitError,
    options?: ErrorOptions
  ) {
    super(body.message, options);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(error.body, { status: error.status });
  }
  logApiError("api.error", error);
  return Response.json(
    { code: "internal_error", message: "unexpected server error" },
    { status: 500 }
  );
}
