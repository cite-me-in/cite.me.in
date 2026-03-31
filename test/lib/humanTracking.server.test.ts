import { beforeEach, describe, expect, it } from "vitest";
import recordHumanVisit, {
  classifyBrowser,
  classifyDevice,
  detectAiReferral,
  isHumanBrowser,
} from "~/lib/humanTracking.server";
import { normalizeDomain } from "~/lib/isSameDomain";
import prisma from "~/lib/prisma.server";

const BASE_URL = import.meta.env.VITE_APP_URL;
const DOMAIN = normalizeDomain(BASE_URL);

async function makeVisit(
  userAgent: string,
  opts: {
    url?: string;
    ip?: string;
    referer?: string | null;
    utmSource?: string | null;
  } = {},
) {
  const site = await prisma.site.findFirstOrThrow({
    where: { domain: DOMAIN },
  });
  return {
    site,
    url: opts.url ?? BASE_URL,
    userAgent,
    ip: opts.ip ?? "1.2.3.4",
    referer: opts.referer ?? null,
    utmSource: opts.utmSource ?? null,
  };
}

// Real-world user agent strings
const UA = {
  chrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  firefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  safari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  opera:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  googlebot:
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  curl: "curl/8.6.0",
  python: "python-requests/2.31.0",
};

describe("classifyBrowser", () => {
  it("should classify Chrome", () => {
    expect(classifyBrowser(UA.chrome)).toBe("Chrome");
  });

  it("should classify Firefox", () => {
    expect(classifyBrowser(UA.firefox)).toBe("Firefox");
  });

  it("should classify Safari", () => {
    expect(classifyBrowser(UA.safari)).toBe("Safari");
  });

  it("should classify Edge before Chrome (Edge UA contains Chrome token)", () => {
    expect(classifyBrowser(UA.edge)).toBe("Edge");
  });

  it("should classify Opera before Chrome (Opera UA contains Chrome token)", () => {
    expect(classifyBrowser(UA.opera)).toBe("Opera");
  });

  it("should classify Chrome on Android as Chrome", () => {
    expect(classifyBrowser(UA.chromeAndroid)).toBe("Chrome");
  });

  it("should classify Safari on iPhone as Safari", () => {
    expect(classifyBrowser(UA.iphone)).toBe("Safari");
  });

  it("should return Other for unrecognized agents", () => {
    expect(classifyBrowser("UnknownClient/1.0")).toBe("Other");
  });
});

describe("classifyDevice", () => {
  it("should classify desktop Chrome as desktop", () => {
    expect(classifyDevice(UA.chrome)).toBe("desktop");
  });

  it("should classify Android Chrome as mobile", () => {
    expect(classifyDevice(UA.chromeAndroid)).toBe("mobile");
  });

  it("should classify iPhone Safari as mobile", () => {
    expect(classifyDevice(UA.iphone)).toBe("mobile");
  });

  it("should classify desktop Firefox as desktop", () => {
    expect(classifyDevice(UA.firefox)).toBe("desktop");
  });

  it("should classify iPad as desktop (post-iPadOS 13 convention)", () => {
    const ipadUA =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15";
    expect(classifyDevice(ipadUA)).toBe("desktop");
  });
});

describe("detectAiReferral", () => {
  it("should detect ChatGPT from referer", () => {
    expect(
      detectAiReferral({
        referer: "https://chat.openai.com/c/abc123",
        utmSource: null,
      }),
    ).toBe("chatgpt");
  });

  it("should detect chatgpt.com from referer", () => {
    expect(
      detectAiReferral({ referer: "https://chatgpt.com/", utmSource: null }),
    ).toBe("chatgpt");
  });

  it("should detect Perplexity from referer", () => {
    expect(
      detectAiReferral({
        referer: "https://perplexity.ai/search/abc",
        utmSource: null,
      }),
    ).toBe("perplexity");
  });

  it("should detect Claude from referer", () => {
    expect(
      detectAiReferral({ referer: "https://claude.ai/", utmSource: null }),
    ).toBe("claude");
  });

  it("should detect Gemini from referer", () => {
    expect(
      detectAiReferral({
        referer: "https://gemini.google.com/app",
        utmSource: null,
      }),
    ).toBe("gemini");
  });

  it("should detect Copilot from referer", () => {
    expect(
      detectAiReferral({
        referer: "https://copilot.microsoft.com/",
        utmSource: null,
      }),
    ).toBe("copilot");
  });

  it("should fall back to utmSource when referer is null", () => {
    expect(
      detectAiReferral({ referer: null, utmSource: "perplexity.ai" }),
    ).toBe("perplexity");
  });

  it("should prefer referer over utmSource when both are present", () => {
    expect(
      detectAiReferral({
        referer: "https://claude.ai/",
        utmSource: "chatgpt.com",
      }),
    ).toBe("claude");
  });

  it("should return null for non-AI referer", () => {
    expect(
      detectAiReferral({ referer: "https://google.com", utmSource: null }),
    ).toBe(null);
  });

  it("should return null when both referer and utmSource are null", () => {
    expect(detectAiReferral({ referer: null, utmSource: null })).toBe(null);
  });

  it("should return null for malformed referer without throwing", () => {
    expect(detectAiReferral({ referer: "not a url", utmSource: null })).toBe(
      null,
    );
  });
});

describe("isHumanBrowser", () => {
  it("should accept Chrome desktop", () => {
    expect(isHumanBrowser(UA.chrome)).toBe(true);
  });

  it("should accept Firefox", () => {
    expect(isHumanBrowser(UA.firefox)).toBe(true);
  });

  it("should accept Safari", () => {
    expect(isHumanBrowser(UA.safari)).toBe(true);
  });

  it("should accept Edge", () => {
    expect(isHumanBrowser(UA.edge)).toBe(true);
  });

  it("should accept mobile Chrome", () => {
    expect(isHumanBrowser(UA.chromeAndroid)).toBe(true);
  });

  it("should reject Googlebot", () => {
    expect(isHumanBrowser(UA.googlebot)).toBe(false);
  });

  it("should reject curl", () => {
    expect(isHumanBrowser(UA.curl)).toBe(false);
  });

  it("should reject python-requests", () => {
    expect(isHumanBrowser(UA.python)).toBe(false);
  });

  it("should reject empty string", () => {
    expect(isHumanBrowser("")).toBe(false);
  });
});

describe("recordHumanVisit", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
    const user = await prisma.user.create({
      data: {
        id: "user-human-1",
        email: "human@test.com",
        passwordHash: "test",
      },
    });
    await prisma.site.create({
      data: {
        apiKey: "test-api-key-human-tracking-1",
        content: "Test content",
        domain: DOMAIN,
        ownerId: user.id,
        summary: "Test summary",
      },
    });
  });

  it("should create a record on first visit", async () => {
    await recordHumanVisit(await makeVisit(UA.chrome));
    const record = await prisma.humanVisit.findFirstOrThrow();
    expect(record.browser).toBe("Chrome");
    expect(record.deviceType).toBe("desktop");
    expect(record.count).toBe(1);
    expect(record.aiReferral).toBeNull();
  });

  it("should increment count on subsequent visits from same visitor same day", async () => {
    await recordHumanVisit(await makeVisit(UA.chrome));
    await recordHumanVisit(await makeVisit(UA.chrome));
    await recordHumanVisit(await makeVisit(UA.chrome));
    const record = await prisma.humanVisit.findFirstOrThrow();
    expect(record.count).toBe(3);
  });

  it("should create separate records for different visitors", async () => {
    await recordHumanVisit(await makeVisit(UA.chrome, { ip: "1.1.1.1" }));
    await recordHumanVisit(await makeVisit(UA.chrome, { ip: "2.2.2.2" }));
    const records = await prisma.humanVisit.findMany();
    expect(records).toHaveLength(2);
  });

  it("should store mobile device type", async () => {
    await recordHumanVisit(await makeVisit(UA.iphone));
    const record = await prisma.humanVisit.findFirstOrThrow();
    expect(record.deviceType).toBe("mobile");
    expect(record.browser).toBe("Safari");
  });

  it("should store AI referral when coming from Perplexity", async () => {
    await recordHumanVisit(
      await makeVisit(UA.chrome, {
        referer: "https://perplexity.ai/search/xyz",
      }),
    );
    const record = await prisma.humanVisit.findFirstOrThrow();
    expect(record.aiReferral).toBe("perplexity");
  });

  it("should store AI referral from utmSource when referer is absent", async () => {
    await recordHumanVisit(
      await makeVisit(UA.chrome, { utmSource: "chatgpt.com" }),
    );
    const record = await prisma.humanVisit.findFirstOrThrow();
    expect(record.aiReferral).toBe("chatgpt");
  });
});
