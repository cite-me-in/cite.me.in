import { HttpResponse, http } from "msw";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import msw from "~/test/mocks/msw";

describe("generateSuggestions", () => {
  const log = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    log.mockClear();
  });

  describe("with successful LLM response", () => {
    beforeAll(() => {
      msw.use(
        http.post("https://api.z.ai/api/paas/v4/chat/completions", () =>
          HttpResponse.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestions: [
                      {
                        title: "Add sitemap.txt",
                        category: "critical",
                        effort: "5 min",
                        description: "Create a sitemap.txt file",
                        fixExample: "https://acme.com/",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        ),
      );
    });

    afterAll(() => {
      msw.resetHandlers();
    });

    it("should return empty array when all checks pass", async () => {
      const { default: generateSuggestions } =
        await import("~/lib/aiLegibility/generateSuggestions");

      const result = await generateSuggestions({
        log,
        checks: [
          {
            name: "Homepage content",
            category: "critical",
            passed: true,
            message: "OK",
          },
          {
            name: "sitemap.txt",
            category: "critical",
            passed: true,
            message: "OK",
          },
        ],
        url: "https://acme.com",
      });

      expect(result).toEqual([]);
    });

    it("should generate suggestions from LLM for failed checks", async () => {
      const { default: generateSuggestions } =
        await import("~/lib/aiLegibility/generateSuggestions");

      const result = await generateSuggestions({
        log,
        checks: [
          {
            name: "Homepage content",
            category: "critical",
            passed: true,
            message: "OK",
          },
          {
            name: "sitemap.txt",
            category: "critical",
            passed: false,
            message: "not found",
          },
        ],
        url: "https://acme.com",
      });

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Add sitemap.txt");
      expect(result[0].category).toBe("critical");
      expect(log).toHaveBeenCalledWith(expect.stringContaining("✓"));
    });

    it("should handle multiple failed checks", async () => {
      const { default: generateSuggestions } =
        await import("~/lib/aiLegibility/generateSuggestions");

      const result = await generateSuggestions({
        log,
        checks: [
          {
            name: "Check A",
            category: "critical",
            passed: false,
            message: "fail",
          },
          {
            name: "Check B",
            category: "important",
            passed: false,
            message: "fail",
          },
        ],
        url: "https://acme.com",
      });

      expect(result).toHaveLength(1);
    });
  });

  describe("with invalid JSON response", () => {
    beforeAll(() => {
      msw.use(
        http.post("https://api.z.ai/api/paas/v4/chat/completions", () =>
          HttpResponse.json({
            choices: [{ message: { content: "invalid json" } }],
          }),
        ),
      );
    });

    afterAll(() => {
      msw.resetHandlers();
    });

    it("should use fallback suggestions when LLM response fails to parse", async () => {
      const { default: generateSuggestions } =
        await import("~/lib/aiLegibility/generateSuggestions");

      const result = await generateSuggestions({
        log,
        checks: [
          {
            name: "sitemap.txt",
            category: "critical",
            passed: false,
            message: "not found",
          },
        ],
        url: "https://acme.com",
      });

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Add sitemap.txt");
      expect(result[0].category).toBe("critical");
    });

    it("should provide specific fallback for Homepage content failures", async () => {
      const { default: generateSuggestions } =
        await import("~/lib/aiLegibility/generateSuggestions");

      const result = await generateSuggestions({
        log,
        checks: [
          {
            name: "Homepage content",
            category: "critical",
            passed: false,
            message: "empty SPA shell",
          },
        ],
        url: "https://acme.com",
      });

      expect(result).toHaveLength(1);
      expect(result[0].title).toContain("server-side content");
      expect(result[0].effort).toBe("1 hour");
    });

    it("should provide specific fallback for JSON-LD failures", async () => {
      const { default: generateSuggestions } =
        await import("~/lib/aiLegibility/generateSuggestions");

      const result = await generateSuggestions({
        log,
        checks: [
          {
            name: "JSON-LD",
            category: "optimization",
            passed: false,
            message: "No JSON-LD found",
          },
        ],
        url: "https://acme.com",
      });

      expect(result).toHaveLength(1);
      expect(result[0].title).toContain("JSON-LD structured data");
      expect(result[0].effort).toBe("15 min");
    });
  });
});
