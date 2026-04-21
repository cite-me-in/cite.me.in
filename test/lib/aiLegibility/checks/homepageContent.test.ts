import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import checkHomepageContent from "~/lib/aiLegibility/checks/homepageContent";
import msw from "~/test/mocks/msw";
import {
  HOMEPAGE_EMPTY_BODY,
  HOMEPAGE_SPA_SHELL,
  HOMEPAGE_WITH_CONTENT,
} from "../fixtures";

describe("checkHomepageContent", () => {
  afterEach(() => {
    msw.resetHandlers();
  });

  it("should pass when homepage has sufficient content", async () => {
    msw.use(
      http.get("https://acme.com/", () =>
        HttpResponse.text(HOMEPAGE_WITH_CONTENT, {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    const result = await checkHomepageContent({
      url: "https://acme.com/",
    });

    expect(result.passed).toBe(true);
    expect(result.name).toBe("Homepage content");
    expect(result.category).toBe("critical");
    expect(result.message).toContain("characters of text content");
    expect(result.html).toBe(HOMEPAGE_WITH_CONTENT);
  });

  it("should fail when homepage is an empty SPA shell", async () => {
    msw.use(
      http.get("https://acme.com/", () =>
        HttpResponse.text(HOMEPAGE_SPA_SHELL, {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    const result = await checkHomepageContent({
      url: "https://acme.com/",
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("empty SPA shell");
    expect(result.details?.isSpaShell).toBe(true);
  });

  it("should fail when homepage has minimal content", async () => {
    msw.use(
      http.get("https://acme.com/", () =>
        HttpResponse.text(HOMEPAGE_EMPTY_BODY, {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    const result = await checkHomepageContent({
      url: "https://acme.com/",
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("minimal content");
  });

  it("should fail when homepage returns HTTP error", async () => {
    msw.use(
      http.get("https://acme.com/", () =>
        HttpResponse.text("Internal Server Error", { status: 500 }),
      ),
    );

    const result = await checkHomepageContent({
      url: "https://acme.com/",
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("HTTP 500");
    expect(result.details?.statusCode).toBe(500);
  });

  it("should handle DNS resolution errors", async () => {
    msw.use(http.get("https://acme.invalid/", () => HttpResponse.error()));

    const result = await checkHomepageContent({
      url: "https://acme.invalid/",
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Failed to fetch homepage");
  });

  it("should handle network errors", async () => {
    msw.use(http.get("https://acme.com/", () => HttpResponse.error()));

    const result = await checkHomepageContent({
      url: "https://acme.com/",
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Failed to fetch homepage");
  });
});
