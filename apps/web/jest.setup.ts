import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

if (typeof globalThis.TextEncoder === "undefined") {
  (globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  (globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder = TextDecoder;
}

// jsdom does not implement ReadableStream (needed for SSE stream tests).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ReadableStream } = require("node:stream/web") as typeof import("node:stream/web");
if (typeof (globalThis as unknown as { ReadableStream?: unknown }).ReadableStream === "undefined") {
  (globalThis as unknown as { ReadableStream: typeof ReadableStream }).ReadableStream = ReadableStream;
}

if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = jest.fn();
}

// jsdom's crypto object lacks randomUUID (used by the toast system).
if (typeof crypto !== "undefined" && typeof crypto.randomUUID !== "function") {
  Object.defineProperty(crypto, "randomUUID", {
    value: () => `test-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    configurable: true,
  });
}
