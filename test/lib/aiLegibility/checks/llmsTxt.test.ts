import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vite-plus/test";
import checkLlmsTxt from "~/lib/aiLegibility/checks/llmsTxt";
import { LLMS_TXT } from "~/test/lib/aiLegibility/fixtures";
import msw from "~/test/mocks/msw";

describe("checkLlmsTxt", () => {
  afterEach(() => {
    msw.resetHandlers();
  });

  it("should pass with valid llms.txt structure (H1, H2 sections, file links)", async () => {
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
    expect(result.message).toContain("well-structured");
    expect(result.details?.hasH1).toBe(true);
    expect(result.details?.h2SectionCount).toBe(2);
    expect(result.details?.hasFileLinks).toBe(true);
  });

  it("should pass with minimal valid structure (H1 + H2 + file links)", async () => {
    msw.use(
      http.get("https://acme.com/llms.txt", () =>
        HttpResponse.text("# Acme Corp\n\n## Pages\n- [Home](https://acme.com/)", {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await checkLlmsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.details?.hasH1).toBe(true);
    expect(result.details?.h2SectionCount).toBe(1);
  });

  it("should pass and note missing H1 title as informative", async () => {
    msw.use(
      http.get("https://acme.com/llms.txt", () =>
        HttpResponse.text("Some content without H1", {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await checkLlmsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("no H1 title");
    expect(result.details?.hasH1).toBe(false);
  });

  it("should pass and note missing H2 sections as informative", async () => {
    msw.use(
      http.get("https://acme.com/llms.txt", () =>
        HttpResponse.text("# Acme Corp\n\nJust a description, no sections.", {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await checkLlmsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
  });

  it("should warn about content under Optional section", async () => {
    msw.use(
      http.get("https://acme.com/llms.txt", () =>
        HttpResponse.text(
          "# Acme Corp\n\n## Pages\n- [Home](https://acme.com/)\n\n## Optional\nThis should be above the Optional section",
          {
            headers: { "Content-Type": "text/plain" },
          },
        ),
      ),
    );

    const result = await checkLlmsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("Optional");
  });

  it("should pass when llms.txt has no Optional section", async () => {
    msw.use(
      http.get("https://acme.com/llms.txt", () =>
        HttpResponse.text("# Acme Corp\n\n## Pages\n- [Home](https://acme.com/)", {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await checkLlmsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.details?.hasOptionalSection).toBe(false);
  });

  it("should detect blockquote in llms.txt", async () => {
    msw.use(
      http.get("https://acme.com/llms.txt", () =>
        HttpResponse.text(
          "# Acme Corp\n\n> A short description.\n\n## Pages\n- [Home](https://acme.com/)",
          {
            headers: { "Content-Type": "text/plain" },
          },
        ),
      ),
    );

    const result = await checkLlmsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.details?.hasBlockquote).toBe(true);
  });

  it("should fail when llms.txt is empty", async () => {
    msw.use(
      http.get("https://acme.com/llms.txt", () =>
        HttpResponse.text("", {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await checkLlmsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("empty");
  });

  it("should fail when llms.txt returns 404", async () => {
    msw.use(http.get("https://acme.com/llms.txt", () => HttpResponse.text("", { status: 404 })));

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
