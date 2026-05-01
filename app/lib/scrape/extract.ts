import { ms } from "convert";
import debug from "debug";
import { Defuddle } from "defuddle/node";
import { parseHTML } from "linkedom";
import captureAndLogError from "~/lib/captureAndLogError.server";

const SUPPORTED_CONTENT_TYPES = ["text/html", "text/markdown"];

const logger = debug("crawl");

export default async function fetchAndExtract({
  url,
  signal,
}: {
  url: URL;
  signal: AbortSignal;
}): Promise<{
  title: string;
  text: string;
  html?: string;
} | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/markdown, text/html;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; cite.me.in/1.0)",
        "sec-ch-ua":
          '"Google Chrome";v="124", "Chromium";v="124", "Not_A Brand";v="24"',
      },
      redirect: "follow",
      signal: AbortSignal.any([signal, AbortSignal.timeout(ms("5s"))]),
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!SUPPORTED_CONTENT_TYPES.some((type) => contentType.includes(type)))
      return null;

    const body = await response.text();
    logger(
      "[crawl] Fetched %s => %s — %d bytes",
      url,
      contentType,
      body.length,
    );
    return contentType.includes("text/markdown")
      ? extractFromMarkdown(body, url)
      : extractFromHtml(body, url);
  } catch (error) {
    captureAndLogError(
      `Error fetching ${url}: ${error instanceof Error ? error.message : String(error)}`,
      { extra: { url } },
    );
    return null;
  }
}

function extractFromMarkdown(body: string, url: URL) {
  const firstLine = body.split("\n").find((l) => l.startsWith("# "));
  const title = firstLine
    ? firstLine.replace(/^#\s+/, "")
    : new URL(url).pathname;
  return { title, text: body };
}

async function extractFromHtml(html: string, url: URL) {
  const jsonText = extractArticleBody(html);
  if (jsonText) return { title: "", text: jsonText, html };

  try {
    const { document } = parseHTML(html);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      const href = canonical.getAttribute("href");
      if (
        href &&
        href !== url.toString() &&
        new URL(href, url).pathname !== url.pathname
      )
        return { title: document.title?.trim() ?? "", text: "", html };
    }

    const result = await Defuddle(document, url.toString(), {
      markdown: true,
    });
    return {
      title:
        result.title?.trim() ?? document.title?.trim() ?? new URL(url).pathname,
      text: result.content?.trim() ?? "",
      html,
    };
  } catch {
    return { title: "", text: "", html };
  }
}

function extractArticleBody(html: string): string | null {
  const scriptRegex =
    /<script[^>]+type=["']application\/ld\+json["']>[^]*?<\/script>/gi;
  let match: RegExpExecArray | null;
  while (true) {
    match = scriptRegex.exec(html);
    if (match === null) break;
    try {
      const ld = JSON.parse(match[1]) as {
        "@type": string | string[];
        articleBody?: string;
      };
      const type =
        typeof ld["@type"] === "string"
          ? ld["@type"]
          : Array.isArray(ld["@type"]) && ld["@type"].length > 0
            ? ld["@type"][0]
            : null;
      if (
        !type ||
        !["Article", "NewsArticle", "BlogPosting"].includes(
          type.replace(/^schema:/i, ""),
        )
      ) {
        continue;
      }
      const articleBody = ld.articleBody;
      if (articleBody && articleBody.length > 50) return articleBody;
    } catch {
      // malformed JSON-LD — try next
    }
  }
  return null;
}
