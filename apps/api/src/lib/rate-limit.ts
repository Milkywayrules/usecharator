interface RateLimitEntry {
  count: number;
  windowStartMs: number;
}

export class SlidingWindowRateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  consume(
    key: string,
    nowMs = Date.now(),
    limitOverride?: number
  ): { allowed: boolean; retryAfterMs: number } {
    const effectiveLimit = limitOverride ?? this.limit;
    const entry = this.store.get(key);
    if (!entry || nowMs - entry.windowStartMs >= this.windowMs) {
      this.store.set(key, { count: 1, windowStartMs: nowMs });
      return { allowed: true, retryAfterMs: 0 };
    }

    if (entry.count >= effectiveLimit) {
      const retryAfterMs = this.windowMs - (nowMs - entry.windowStartMs);
      return { allowed: false, retryAfterMs };
    }

    entry.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }
}

export function clientIpFromHeaders(
  headers: Headers,
  fallback = "unknown"
): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((part) => part.trim());
    const rightmost = hops.at(-1);
    if (rightmost) {
      return rightmost;
    }
  }
  return headers.get("x-real-ip") ?? fallback;
}
