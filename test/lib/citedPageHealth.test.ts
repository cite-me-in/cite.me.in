import { afterEach, describe, expect, it, vi } from "vitest";
import checkCitingPageHealth from "~/lib/citingPageHealth.server";

describe("checkCitingPageHealth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return healthy for a 200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        text: vi.fn().mockResolvedValue("<html>content</html>"),
      }),
    );

    const result = await checkCitingPageHealth("https://example.com/page");
    expect(result.statusCode).toBe(200);
    expect(result.isHealthy).toBe(true);
    expect(result.contentHash).toBeTruthy();
  });

  it("should return unhealthy for a 404 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 404,
        text: vi.fn().mockResolvedValue("Not found"),
      }),
    );

    const result = await checkCitingPageHealth("https://example.com/gone");
    expect(result.statusCode).toBe(404);
    expect(result.isHealthy).toBe(false);
  });

  it("should return unhealthy when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );

    const result = await checkCitingPageHealth("https://down.example.com");
    expect(result.statusCode).toBeNull();
    expect(result.isHealthy).toBe(false);
  });
});
