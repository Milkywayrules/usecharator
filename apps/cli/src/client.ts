import { type ApiError, apiErrorSchema } from "@charator/shared";
import { apiBase, type ResolvedConfig } from "./config";

export class ApiClientError extends Error {
  readonly apiError: ApiError;
  readonly status: number;

  constructor(status: number, apiError: ApiError) {
    super(apiError.message);
    this.name = "ApiClientError";
    this.status = status;
    this.apiError = apiError;
  }
}

export interface RequestOptions {
  auth?: boolean;
  body?: unknown;
  method?: string;
  path: string;
  query?: Record<string, string | number | undefined>;
}

export type FetchImpl = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export class ApiClient {
  readonly config: ResolvedConfig;
  private readonly fetchImpl: FetchImpl;

  constructor(config: ResolvedConfig, fetchImpl: FetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async request<T = unknown>(options: RequestOptions): Promise<T> {
    const url = new URL(`${apiBase(this.config)}${options.path}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (options.auth) {
      if (!this.config.token) {
        throw new ApiClientError(401, {
          code: "unauthorized",
          message: "missing API token",
        });
      }
      headers.Authorization = `Bearer ${this.config.token}`;
    }

    const response = await this.fetchImpl(url.toString(), {
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      headers,
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new ApiClientError(response.status, {
          code: "invalid_response",
          message: text.slice(0, 200) || "invalid JSON response",
        });
      }
    }

    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(payload);
      if (parsed.success) {
        throw new ApiClientError(response.status, parsed.data);
      }
      throw new ApiClientError(response.status, {
        code: "http_error",
        message: `request failed with status ${response.status}`,
      });
    }

    return payload as T;
  }
}
