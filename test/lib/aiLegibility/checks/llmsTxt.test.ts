import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vite-plus/test";
import checkLlmsTxt from "~/lib/aiLegibility/checks/llmsTxt";
import msw from "~/test/mocks/msw";
import { LLMS_TXT } from "../fixtures";

describe("checkLlmsTxt", () => {
  afterEach(() => {
    msw.resetHandlers();
  });

  it("should pass when llms.txt has content", async () => {
    msw.use(
      http.get("https://acme.com/llms.txt", () =>
        HttpResponse.text(LLMS_TXT, {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await checkLlmsTxt({
      url: "https://acme.com/",
    });

    expect(result.passed).toBe(true);
    expect(result.name).toBe("llms.txt");
    expect(result.category).toBe("optimization");
    expect(result.message).toContain("5 lines");
  });

  it("should pass when llms.txt exists but is empty", async () => {
    msw.use(
      http.get("https://acme.com/llms.txt", () =>
        HttpResponse.text("", {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await checkLlmsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("empty");
  });

  it("should fail when llms.txt returns 404", async () => {
    msw.use(
      http.get("https://acme.com/llms.txt", () =>
        HttpResponse.text("", { status: 404 }),
      ),
    );

    const result = await checkLlmsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("should handle network errors", async () => {
    msw.use(http.get("https://acme.com/llms.txt", () => HttpResponse.error()));

    const result = await checkLlmsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Failed to fetch");
  });
});
