import parseHTMLTree, {
  getElementsByTagName,
  getMainContent,
  htmlToMarkdown,
} from "~/lib/html/parseHTML";
import type { HTMLNode } from "~/lib/html/HTMLNode";

export type ExtractionResult = {
  title: string;
  text: string;
};

const SUPPORTED_CONTENT_TYPES = ["text/html", "text/markdown"];

export async function fetchAndExtract(
  url: string,
  signal: AbortSignal,
): Promise<ExtractionResult | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
      redirect: "follow",
      headers: { Accept: "text/markdown, text/html;q=0.9" },
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!SUPPORTED_CONTENT_TYPES.some((t) => contentType.includes(t))) return null;

  const body = await response.text();

  if (contentType.includes("text/markdown")) return extractFromMarkdown(body, url);
  return extractFromHtml(body, url);
}

function extractFromMarkdown(body: string, url: string): ExtractionResult {
  const firstLine = body.split("\n").find((l) => l.startsWith("# "));
  const title = firstLine ? firstLine.replace(/^#\s+/, "") : new URL(url).pathname;
  return { title, text: body };
}

export function extractFromHtml(html: string, url: string): ExtractionResult {
  const tree = parseHTMLTree(html);

  const titleNodes = getElementsByTagName(tree, "title");
  const title =
    titleNodes[0]?.children
      .filter((n): n is HTMLNode & { type: "text" } => n.type === "text")
      .map((n) => n.content)
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
        return { title, text: "" };
    }
  }

  // JSON-LD articleBody — must extract from raw HTML because parseHTMLTree strips <script> tags
  const jsonLdText = extractJsonLdArticleBody(html);
  if (jsonLdText) return { title, text: jsonLdText };

  const text = extractSemanticContent(tree);
  return { title, text };
}

function extractJsonLdArticleBody(html: string): string | null {
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while (true) {
    match = scriptRegex.exec(html);
    if (match === null) break;
    try {
      const ld = JSON.parse(match[1]) as Record<string, unknown>;
      const articleBody = ld.articleBody as string | undefined;
      if (articleBody && articleBody.length > 50) return articleBody;
    } catch {
      // malformed JSON-LD — try next
    }
  }
  return null;
}

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

function getAllElements(
  nodes: HTMLNode[],
): (HTMLNode & { type: "element" })[] {
  const result: (HTMLNode & { type: "element" })[] = [];
  for (const node of nodes) {
    if (node.type === "element") {
      result.push(node);
      result.push(...getAllElements(node.children));
    }
  }
  return result;
}
