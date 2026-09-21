export type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

export type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimiter = {
  check(key: string): boolean;
  reset(key: string): void;
};

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const buckets = new Map<string, RateLimitBucket>();
  const now = (): number => Date.now();

  return {
    check(key: string): boolean {
      const t = now();
      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= t) {
        buckets.set(key, { count: 1, resetAt: t + config.windowMs });
        return true;
      }
      if (existing.count >= config.maxRequests) return false;
      existing.count += 1;
      return true;
    },
    reset(key: string): void {
      buckets.delete(key);
    },
  };
}
