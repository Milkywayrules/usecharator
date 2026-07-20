import type { AuthUser } from "../auth";
import { db } from "../auth";
import { config } from "../config";
import { authenticatedRateLimitForTier, getUserTier } from "./entitlements";
import { HttpError } from "./errors";
import { clientIpFromHeaders, SlidingWindowRateLimiter } from "./rate-limit";

export const anonymousGenerationLimiter = new SlidingWindowRateLimiter(
  config.RATE_LIMIT_ANONYMOUS_PER_HOUR,
  60 * 60 * 1000
);

export const authenticatedGenerationLimiter = new SlidingWindowRateLimiter(
  config.RATE_LIMIT_AUTHENTICATED_PER_HOUR,
  60 * 60 * 1000
);

export async function consumeGenerationRateLimit(
  authUser: AuthUser | null,
  request: Request
): Promise<void> {
  const ip = clientIpFromHeaders(request.headers);
  if (!authUser) {
    const limit = anonymousGenerationLimiter.consume(`ip:${ip}`);
    if (!limit.allowed) {
      throw new HttpError(429, {
        code: "rate_limited",
        message: "too many generation requests",
      });
    }
    return;
  }

  const tier = await getUserTier(db, authUser.id);
  const hourlyLimit = authenticatedRateLimitForTier(tier);
  const limit = authenticatedGenerationLimiter.consume(
    `user:${authUser.id}`,
    Date.now(),
    hourlyLimit
  );
  if (!limit.allowed) {
    throw new HttpError(429, {
      code: "rate_limited",
      message: "too many generation requests",
    });
  }
}
