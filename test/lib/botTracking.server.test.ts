import { beforeEach, describe, expect, it } from "vite-plus/test";
import recordBotVisit from "~/lib/botTracking.server";
import envVars from "~/lib/envVars.server";
import { normalizeDomain } from "~/lib/isSameDomain";
import prisma from "~/lib/prisma.server";

async function makeRequest(
  userAgent: string,
  url = new URL("/", envVars.VITE_APP_URL).toString(),
  accept?: string,
  referer?: string,
) {
  const headers: Record<string, string> = { "user-agent": userAgent };
  if (accept) headers.accept = accept;
  const site = await prisma.site.findFirstOrThrow({
    where: { domain: normalizeDomain(url) },
  });
  return {
    accept: accept || null,
    ip: "127.0.0.1",
    referer: referer || null,
    site,
    url,
    userAgent,
  };
}

describe("trackBotVisit", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
    const user = await prisma.user.create({
      data: { id: "user-bot-1", email: "bot@test.com", passwordHash: "test" },
    });
    await prisma.site.create({
      data: {
        ownerId: user.id,
        apiKey: "test-api-key-bot-tracking-1",
        domain: new URL(envVars.VITE_APP_URL).hostname,
        content: "Test content",
        summary: "Test summary",
      },
    });
  });

  it("should ignore regular browser user agents", async () => {
    await recordBotVisit(
      await makeRequest(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      ),
    );
    const last = await prisma.botVisit.findFirst();
    expect(last).toBeNull();
  });

  it("should track a known bot by type", async () => {
    await recordBotVisit(
      await makeRequest(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      ),
    );
    const last = await prisma.botVisit.findFirstOrThrow();
    expect(last.botType).toBe("Google");
  });

  it("should track an unknown bot as 'Other Bot'", async () => {
    await recordBotVisit(await makeRequest("custom-spider/1.0"));
    const last = await prisma.botVisit.findFirstOrThrow();
    expect(last.botType).toBe("Other Bot");
  });

  it("should record domain and path from request URL", async () => {
    await recordBotVisit(
      await makeRequest(
        "Googlebot/2.1",
        new URL("/blog/post", envVars.VITE_APP_URL).toString(),
      ),
    );
    const last = await prisma.botVisit.findFirstOrThrow();
    expect(last.path).toBe("/blog/post");
  });

  it("should parse Accept header into MIME type array, stripping quality values", async () => {
    await recordBotVisit(
      await makeRequest(
        "Googlebot/2.1",
        new URL("/", envVars.VITE_APP_URL).toString(),
        "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      ),
    );
    const last = await prisma.botVisit.findFirstOrThrow();
    expect(last.accept).toEqual(["text/html", "application/xhtml+xml", "*/*"]);
  });

  it("should record referer if present", async () => {
    await recordBotVisit(
      await makeRequest(
        "Googlebot/2.1",
        new URL("/", envVars.VITE_APP_URL).toString(),
        "text/html",
        "https://google.com",
      ),
    );
    const last = await prisma.botVisit.findFirstOrThrow();
    expect(last.referer).toBe("https://google.com");
  });

  it("should not record referer if it is the same as the request URL", async () => {
    await recordBotVisit(
      await makeRequest(
        "Googlebot/2.1",
        new URL("/", envVars.VITE_APP_URL).toString(),
        "text/html",
        new URL("/", envVars.VITE_APP_URL).toString(),
      ),
    );
    const last = await prisma.botVisit.findFirst();
    expect(last?.referer).toBeNull();
  });
});
