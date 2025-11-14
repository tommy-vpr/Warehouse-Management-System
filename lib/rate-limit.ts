// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create Redis instance
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Different rate limiters for different use cases
export const signupRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 m"), // 3 signups per 15 minutes
  analytics: true,
  prefix: "ratelimit:signup",
});

export const signinRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 signin attempts per 15 minutes
  analytics: true,
  prefix: "ratelimit:signin",
});

export const emailVerificationRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 h"), // 3 verification requests per hour
  analytics: true,
  prefix: "ratelimit:verify",
});

export const generalApiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
  analytics: true,
  prefix: "ratelimit:api",
});

// Helper function to get client identifier (IP or user ID)
export function getIdentifier(req: Request): string {
  // Try to get IP from various headers (Cloudflare, Vercel, etc.)
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip");

  const ip = cfConnectingIp || forwarded?.split(",")[0] || realIp || "unknown";
  return ip;
}

// Helper to handle rate limit response
export function rateLimitResponse(
  success: boolean,
  limit: number,
  remaining: number,
  reset: number
) {
  if (!success) {
    return Response.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
          "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // When success = true, return a harmless OK response
  return Response.json(
    { success: true },
    {
      status: 200,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      },
    }
  );
}
