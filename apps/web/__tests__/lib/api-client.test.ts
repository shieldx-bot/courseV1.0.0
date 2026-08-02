/**
 * @jest-environment node
 */

import { apiFetch, ApiClientError, isApiSuccess } from "@/lib/api-client";

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
