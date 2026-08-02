/**
 * @jest-environment node
 */

import { apiFetch, ApiClientError, isApiSuccess, typedRequest } from "@/lib/api-client";

describe("apiFetch", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("throws on non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not found"),
    });

    await expect(apiFetch("/test")).rejects.toThrow("Not found");
  });

  it("returns JSON on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: "hello" }),
    });

    const result = await apiFetch("/test");
    expect(result).toEqual({ data: "hello" });
  });

  it("throws ApiClientError with envelope code/message on failure envelope", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: false,
          error: { code: "COURSE_NOT_FOUND", message: "No such course" },
          meta: { detail: "x" },
        }),
    });

    const err = await apiFetch("/courses/nope").catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ status: 200, code: "COURSE_NOT_FOUND", message: "No such course" });
  });

  it("throws ApiClientError with string error from envelope", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: false, error: "Flat failure message" }),
    });

    const err = await apiFetch("/test").catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ message: "Flat failure message", code: undefined });
  });

  it("unwraps success envelope data", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: { id: 1, name: "alpha" }, error: null }),
    });

    const result = await apiFetch<{ id: number; name: string }>("/test");
    expect(result).toEqual({ id: 1, name: "alpha" });
  });

  it("passes through plain JSON (non-envelope) responses", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ hello: "world" }),
    });

    const result = await apiFetch("/test");
    expect(result).toEqual({ hello: "world" });
  });

  it("returns undefined on 204", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error("no body")),
    });

    const result = await apiFetch("/test");
    expect(result).toBeUndefined();
  });

  it("captures the X-Request-ID header into ApiClientError.meta.request_id on envelope errors", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name === "X-Request-ID" ? "req-123" : null) },
      json: () => Promise.resolve({ success: false, error: { code: "RATE_LIMIT", message: "Slow down" } }),
    });

    const err = (await apiFetch("/test").catch((e) => e)) as ApiClientError;
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.meta?.request_id).toBe("req-123");
  });

  it("captures the X-Request-ID header on non-ok responses", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: (name: string) => (name === "X-Request-ID" ? "req-999" : null) },
      text: () => Promise.resolve("unavailable"),
    });

    const err = (await apiFetch("/test").catch((e) => e)) as ApiClientError;
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.meta?.request_id).toBe("req-999");
  });

  it("leaves meta.request_id undefined when the response has no X-Request-ID header", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("boom"),
    });

    const err = (await apiFetch("/test").catch((e) => e)) as ApiClientError;
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.meta?.request_id).toBeUndefined();
  });
});

describe("typedRequest", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("resolves params, appends query string, and sends JSON body", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: { id: 1 } }),
    });
    global.fetch = fetchMock;

    await typedRequest<"post", string, { id: number }>("post", "POST /courses/{course_id}/discussions", {
      params: { course_id: "abc 123" },
      query: { page: 2, sort: "newest", flag: null, maybe: undefined },
      body: { title: "Hi" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/courses/abc%20123/discussions");
    expect(url).toContain("page=2");
    expect(url).toContain("sort=newest");
    expect(url).not.toContain("flag=");
    expect(url).not.toContain("maybe=");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ title: "Hi" });
  });

  it("unwraps success envelope data with the typed generic", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: { user: { id: "u1" } } }),
    });

    const result = await typedRequest<"get", string, { user: { id: string } }>("get", "GET /auth/me");
    expect(result.user.id).toBe("u1");
  });

  it("retries the original request after a successful refresh on 401", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve("unauthorized") })
      .mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve("ok") })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { ok: true } }),
      });
    global.fetch = fetchMock;

    const result = await apiFetch("/test");
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("isApiSuccess", () => {
  it("returns true for a success envelope", () => {
    expect(isApiSuccess({ success: true, data: {} })).toBe(true);
  });

  it("returns false for failure envelope or non-objects", () => {
    expect(isApiSuccess({ success: false, error: "nope" })).toBe(false);
    expect(isApiSuccess(null)).toBe(false);
    expect(isApiSuccess("success")).toBe(false);
  });
});
