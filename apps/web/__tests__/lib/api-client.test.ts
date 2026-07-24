/**
 * @jest-environment node
 */

import { apiFetch } from "@/lib/api-client";

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
});
