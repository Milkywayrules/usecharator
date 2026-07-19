import { type ApiError, apiErrorSchema } from "@charator/shared";

const TRAILING_SLASHES = /\/+$/;

export class CharatorApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly apiMessage: string;

  constructor(status: number, body: ApiError) {
    super(`${body.code}: ${body.message}`);
    this.name = "CharatorApiError";
    this.status = status;
    this.code = body.code;
    this.apiMessage = body.message;
  }
}

export interface CharatorClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  token?: string;
}

export type AuthMode = "none" | "optional" | "required";

export interface RequestOptions {
  auth?: AuthMode;
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
}

function parseResponseBody(response: Response, text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (parseError: unknown) {
    const message = text || response.statusText || "request failed";
    const body: ApiError = response.ok
      ? { code: "invalid_response", message: "API returned non-JSON response" }
      : { code: "http_error", message };
    const error = new CharatorApiError(response.status, body);
    if (parseError instanceof Error) {
      error.cause = parseError;
    }
    throw error;
  }
}

function throwHttpError(
  response: Response,
  payload: unknown,
  text: string
): never {
  const parsed = apiErrorSchema.safeParse(payload);
  if (parsed.success) {
    throw new CharatorApiError(response.status, parsed.data);
  }
  throw new CharatorApiError(response.status, {
    code: "http_error",
    message: text || response.statusText || "request failed",
  });
}

export class CharatorClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly token?: string;

  constructor(options: CharatorClientOptions) {
    this.baseUrl = options.baseUrl.replace(TRAILING_SLASHES, "");
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  hasToken(): boolean {
    return Boolean(this.token);
  }

  async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const auth = options.auth ?? "none";
    if (auth === "required" && !this.token) {
      throw new CharatorApiError(401, {
        code: "unauthorized",
        message:
          "authentication required — set CHARATOR_API_TOKEN to a bearer token from Chara Tor web settings (ct_live_...)",
      });
    }

    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined || value === null || value === "") {
          continue;
        }
        url.searchParams.set(key, String(value));
      }
    }

    const headers = new Headers({ Accept: "application/json" });
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    if (this.token && auth !== "none") {
      headers.set("Authorization", `Bearer ${this.token}`);
    }

    const response = await this.fetchImpl(url, {
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      headers,
      method,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    const payload = parseResponseBody(response, text);
    if (!response.ok) {
      throwHttpError(response, payload, text);
    }

    return payload as T;
  }
}

export function normalizeFetchError(error: unknown): CharatorApiError {
  if (error instanceof CharatorApiError) {
    return error;
  }
  if (error instanceof Error) {
    return new CharatorApiError(0, {
      code: "network_error",
      message: error.message,
    });
  }
  return new CharatorApiError(0, {
    code: "unknown_error",
    message: String(error),
  });
}
