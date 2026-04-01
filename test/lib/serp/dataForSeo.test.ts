import { describe, expect, it, vi } from "vitest";
import fetchAioResults from "~/lib/serp/dataForSeo.server";

vi.mock("~/lib/envVars.server", () => ({
  default: {
    DATAFORSEO_LOGIN: "test@example.com",
    DATAFORSEO_PASSWORD: "test-password",
  },
}));

const makeResponse = (items: unknown[]) =>
  ({
    ok: true,
    json: async () => ({
      tasks: [{ result: [{ items }] }],
    }),
  }) as Response;

describe("fetchAioResults", () => {
  it("should return aioPresent=true and citations when AIO block exists", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeResponse([
        {
          type: "ai_overview",
          references: [
            { url: "https://example.com/page" },
            { url: "https://other.com/" },
          ],
        },
        { type: "organic", url: "https://example.com" },
      ]),
    );

    const result = await fetchAioResults("best retail space platforms");

    expect(result).toEqual({
      aioPresent: true,
      citations: ["https://example.com/page", "https://other.com/"],
    });
  });

  it("should return aioPresent=false and empty citations when no AIO block", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeResponse([
        { type: "organic", url: "https://example.com" },
      ]),
    );

    const result = await fetchAioResults("niche query with no AIO");

    expect(result).toEqual({ aioPresent: false, citations: [] });
  });

  it("should return aioPresent=true and empty citations when AIO has no references", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeResponse([{ type: "ai_overview", references: [] }]),
    );

    const result = await fetchAioResults("query");

    expect(result).toEqual({ aioPresent: true, citations: [] });
  });

  it("should throw when the API response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as Response);

    await expect(fetchAioResults("query")).rejects.toThrow("DataForSEO error 401");
  });
});
