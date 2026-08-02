/// <reference types="@cloudflare/workers-types" />

declare module "cloudflare:workers" {
  export interface DurableObjectState {
    storage: DurableObjectStorage;
    blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
    waitUntil(promise: Promise<unknown>): void;
    acceptWebSocket(webSocket: WebSocket): void;
    getWebSockets(): WebSocket[];
  }

  export interface DurableObjectStorage {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<boolean>;
    list(options?: { prefix?: string; start?: string; end?: string; limit?: number; reverse?: boolean }): Promise<Map<string, unknown>>;
    transaction<T>(callback: (txn: DurableObjectTransaction) => Promise<T>): Promise<T>;
  }

  export interface DurableObjectTransaction {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<boolean>;
  }

  export class DurableObject {
    constructor(ctx: DurableObjectState, env: any);
    fetch(request: Request): Promise<Response> | Response;
  }

  export interface DurableObjectNamespace {
    idFromName(name: string): DurableObjectId;
    idFromString(id: string): DurableObjectId;
    get(id: DurableObjectId): DurableObjectStub;
    newUniqueId(): DurableObjectId;
  }

  export interface DurableObjectId {
    toString(): string;
    equals(other: DurableObjectId): boolean;
  }

  export interface DurableObjectStub {
    fetch(request: Request | string, init?: RequestInit): Promise<Response>;
  }
}

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  R2_BUCKET: R2Bucket;
  JWT_SECRET: string;
  RATE_LIMITER: DurableObjectNamespace;
  BACKGROUND_QUEUE: Queue;
  FRONTEND_URL: string;
  API_BASE_URL: string;
  ENVIRONMENT: string;
}