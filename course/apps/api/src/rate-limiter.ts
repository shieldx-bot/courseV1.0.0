interface RateLimitEntry {
  timestamps: number[];
}

export async function checkRateLimit(
  cache: KVNamespace,
  key: string,
  limit = 100,
  windowMs = 60000
): Promise<{ allowed: boolean; remaining: number; reset: number; retryAfter?: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;

  const stored = await cache.get(key, "json");
  let entry: RateLimitEntry = { timestamps: [] };

  if (stored) {
    entry = stored as RateLimitEntry;
  }

  entry.timestamps = entry.timestamps.filter((ts: number) => ts > windowStart);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      reset: Math.ceil((oldest + windowMs) / 1000),
      retryAfter,
    };
  }

  entry.timestamps.push(now);

  await cache.put(key, JSON.stringify(entry), {
    expirationTtl: Math.ceil(windowMs / 1000),
  });

  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    reset: Math.ceil((now + windowMs) / 1000),
  };
}

export async function resetRateLimit(cache: KVNamespace, key: string): Promise<void> {
  await cache.delete(key);
}
