import { DurableObject, DurableObjectState } from "cloudflare:workers";

interface Env {
  RATE_LIMITER: DurableObjectNamespace;
}

export class RateLimiter extends DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.state = ctx;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/check") {
      return this.checkLimit(request);
    }

    if (path === "/reset") {
      return this.resetLimit(request);
    }

    return new Response("Not found", { status: 404 });
  }

  private async checkLimit(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { key: string; limit: number; windowMs: number };
      const { key, limit = 100, windowMs = 60000 } = body;

      if (!key) {
        return new Response(JSON.stringify({ error: "Missing key" }), { status: 400 });
      }

      const now = Date.now();
      const windowStart = now - windowMs;

      // Get existing requests
      const stored = await this.state.storage.get<{ timestamps: number[] }>(key);
      const timestamps = stored?.timestamps.filter((ts: number) => ts > windowStart) || [];

      // Check if limit exceeded
      if (timestamps.length >= limit) {
        const oldest = timestamps[0];
        const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
        return new Response(
          JSON.stringify({
            allowed: false,
            limit,
            remaining: 0,
            reset: Math.ceil((oldest + windowMs) / 1000),
            retryAfter,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      // Add current request
      timestamps.push(now);
      await this.state.storage.put(key, { timestamps });

      return new Response(
        JSON.stringify({
          allowed: true,
          limit,
          remaining: limit - timestamps.length,
          reset: Math.ceil((now + windowMs) / 1000),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
    }
  }

  private async resetLimit(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { key: string };
      const { key } = body;

      if (!key) {
        return new Response(JSON.stringify({ error: "Missing key" }), { status: 400 });
      }

      await this.state.storage.delete(key);
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
    }
  }
}