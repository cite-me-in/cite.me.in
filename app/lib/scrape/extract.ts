import { ms } from "convert";
import debug from "debug";
import type { HTMLNode } from "~/lib/html/HTMLNode";
import parseHTMLTree, {
  getElementsByTagName,
  getMainContent,
  htmlToMarkdown,
} from "~/lib/html/parseHTML";
import logError from "../logError.server";

const SUPPORTED_CONTENT_TYPES = ["text/html", "text/markdown"];

const logger = debug("crawl");

/**
 * Fetches a document and extracts the title, text, and HTML from it. If the
 * document is Markdown returns the title and text directly. If the document is
 * HTML returns the title, text, and raw HTML. If the document is not HTML or
 * Markdown returns null.
 *
 * @param url - The URL of the document to fetch and extract.
 * @param signal - The abort signal to use to cancel the fetch.
 * @returns The title, text, and HTML of the document or null if the fetch or extraction fails.
 */
export async function fetchAndExtract(
  url: string,
  signal: AbortSignal,
): Promise<{
  title: string;
  text: string;
  html?: string;
} | null> {
  try {
    const response = await fetch(new URL(url), {
      headers: { Accept: "text/markdown, text/html;q=0.9" },
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
    logError(`Error fetching ${url}: ${error}`, { extra: { url } });
    return null;
  }
}

/**
 * Extracts the title and text from a Markdown document.
 *
 * @param body - The markdown document.
 * @param url - The URL of the document.
 * @returns The title and text.
 */
function extractFromMarkdown(
  body: string,
  url: string,
): {
  title: string;
  text: string;
} {
  const firstLine = body.split("\n").find((l) => l.startsWith("# "));
  const title = firstLine
    ? firstLine.replace(/^#\s+/, "")
    : new URL(url).pathname;
  return { title, text: body };
}

/**
 * Extracts the title and text from an HTML document.
 *
 * @param html - The HTML document.
 * @param url - The URL of the document.
 * @returns The title and text.
 */
function extractFromHtml(
  html: string,
  url: string,
): {
  title: string;
  text: string;
  html: string;
} {
  const tree = parseHTMLTree(html);

  const titleNodes = getElementsByTagName(tree, "title");
  const title =
    titleNodes[0]?.children
      .filter(
        (node): node is HTMLNode & { type: "text" } => node.type === "text",
      )
      .map((node) => node.content)
      .join("") ?? new URL(url).pathname;

  // Check rel=canonical — if points elsewhere, return empty text (caller skips)
  const links = getElementsByTagName(tree, "link");
  for (const link of links) {
    if (link.attributes.rel === "canonical") {
      const canonical = link.attributes.href;
      if (
        canonical &&
        canonical !== url &&
        new URL(canonical, url).pathname !== new URL(url).pathname
      )
        return { title, text: "", html };
    }
  }

  // JSON-LD articleBody — must extract from raw HTML because parseHTMLTree strips <script> tags
  const jsonText = extractArticleBody(html);
  if (jsonText) return { title, text: jsonText, html };

  const text = extractSemanticContent(tree);
  return { title, text, html };
}

/**
 * Extracts the article body from a JSON-LD script tag in an HTML document.
 * Expects the script tag to have a type attribute of "application/ld+json"
 * and to contain a JSON object with an "articleBody" field and a @type field
 * of "Article", "NewsArticle", or "BlogPosting" per schema.org.
 *
 * @param html - The HTML document.
 * @returns The article body or null if not found.
 */
function extractArticleBody(html: string): string | null {
  const scriptRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while (true) {
    match = scriptRegex.exec(html);
    if (match === null) break;
    try {
      const ld = JSON.parse(match[1]) as Record<string, unknown>;
      // Check if ld is an Article or NewsArticle or BlogPosting per schema.org
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
        continue; // skip if not an Article type
      }
      const articleBody = ld.articleBody as string | undefined;
      if (articleBody && articleBody.length > 50) return articleBody;
    } catch {
      // malformed JSON-LD — try next
    }
  }
  return null;
}

/**
 * Extracts the semantic content from an HTML tree.
 * Uses the following selectors in priority order:
 * - <main>
 * - <article>
 * - [role="main"]
 * - #content
 * - #main
 * - #root
 * - <body>
 * - fallback to getMainContent()
 *
 * @param tree - The HTML tree.
 * @returns The semantic content.
 */
function extractSemanticContent(tree: HTMLNode[]): string {
  const mainEl = getElementsByTagName(tree, "main")[0];
  if (mainEl) return htmlToMarkdown(mainEl.children);

  const articleEl = getElementsByTagName(tree, "article")[0];
  if (articleEl) return htmlToMarkdown(articleEl.children);

  const allEls = getAllElements(tree);
  const roleMain = allEls.find((n) => n.attributes?.role === "main");
  if (roleMain) return htmlToMarkdown(roleMain.children);

  const idContent = allEls.find(
    (n) =>
      n.attributes?.id === "content" ||
      n.attributes?.id === "main" ||
      n.attributes?.id === "root",
  );
  if (idContent) return htmlToMarkdown(idContent.children);

  return htmlToMarkdown(getMainContent(tree));
}

/**
 * Gets all elements from an HTML tree.
 *
 * @param nodes - The HTML tree.
 * @returns All elements.
 */
function getAllElements(nodes: HTMLNode[]): (HTMLNode & { type: "element" })[] {
  const result: (HTMLNode & { type: "element" })[] = [];
  for (const node of nodes) {
    if (node.type === "element") {
      result.push(node);
      result.push(...getAllElements(node.children));
    }
  }
  return result;
}
