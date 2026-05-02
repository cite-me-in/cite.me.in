import { Defuddle } from "defuddle/node";

const MIN_CONTENT_LENGTH = 100;
const MIN_WORD_COUNT = 25;

const SPA_PATTERNS = [
  /<div\s+id\s*=\s*["']root["']/i,
  /<div\s+id\s*=\s*["']app["']/i,
  /<div\s+id\s*=\s*["']__next["']/i,
  /<div\s+id\s*=\s*["']__nuxt["']/i,
  /<div\s+id\s*=\s*["']___gatsby["']/i,
  /<div\s+id\s*=\s*["']svelte["']/i,
  /<div\s+id\s*=\s*["']__svelte["']/i,
  /<div\s+id\s*=\s*["']react-root["']/i,
  /<div\s+id\s*=\s*["']app-root["']/i,
  /<div\s+id\s*=\s*["']application-root["']/i,
  /<div\s+id\s*=\s*["']__remix["']/i,
  /<div\s+id\s*=\s*["']app-shell["']/i,
  /<div\s+id\s*=\s*["']page-mount["']/i,
  /<div\s+class\s*=\s*["']app["']/i,
];

export function extractHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  const link = response.headers.get("Link");
  const xRobots = response.headers.get("X-Robots-Tag");
  const contentType = response.headers.get("Content-Type");
  if (link) headers["Link"] = link;
  if (xRobots) headers["X-Robots-Tag"] = xRobots;
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

function hasParagraphs(text: string): boolean {
  return /\n\s*\n/.test(text);
}

function hasSentenceEndings(text: string): boolean {
  return /[.!?]\s+[A-Z]/.test(text.replace(/[^a-zA-Z0-9.!?]/g, " ").trim());
}

function hasHeadings(html: string): boolean {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  return /<h[1-3][^>]*>/i.test(body);
}

type ContentAssessment = {
  isSpaShell: boolean;
  contentLength: number;
  wordCount: number;
  hasRealContent: boolean;
  enoughWords: boolean;
  paragraphs: boolean;
  sentenceEndings: boolean;
  headings: boolean;
  usefulnessSignals: string[];
  useful: boolean;
};

export async function assessContent(
  html: string,
  url?: string,
): Promise<ContentAssessment> {
  const { textContent, wordCount } = await _extractContent(html, url);
  const contentLength = textContent.length;

  const isSpaShell = SPA_PATTERNS.some((pattern) => pattern.test(html));
  const hasRealContent = contentLength >= MIN_CONTENT_LENGTH;
  const enoughWords = wordCount >= MIN_WORD_COUNT;
  const paragraphs = hasParagraphs(textContent);
  const sentenceEndings = hasSentenceEndings(textContent);
  const headings = hasHeadings(html);

  const usefulnessSignals: string[] = [];
  if (!paragraphs) usefulnessSignals.push("no paragraph breaks");
  if (!sentenceEndings) usefulnessSignals.push("no sentence structure");
  if (!headings) usefulnessSignals.push("no headings");
  if (!enoughWords)
    usefulnessSignals.push(`only ${wordCount} words (need ${MIN_WORD_COUNT})`);

  const useful = hasRealContent && enoughWords;

  return {
    isSpaShell,
    contentLength,
    wordCount,
    hasRealContent,
    enoughWords,
    paragraphs,
    sentenceEndings,
    headings,
    usefulnessSignals,
    useful,
  };
}

async function _extractContent(
  html: string,
  url?: string,
): Promise<{
  textContent: string;
  wordCount: number;
}> {
  try {
    const result = await Defuddle(html, url ?? "https://unknown", {
      removeExactSelectors: true,
      removePartialSelectors: true,
      removeHiddenElements: true,
      removeLowScoring: true,
    });

    const textContent = result.content.replace(/<[^>]+>/g, "").trim();
    const wordCount = result.wordCount;

    return { textContent, wordCount };
  } catch {
    const textContent = html.replace(/<[^>]+>/g, "").trim();
    const wordCount = textContent.split(/\s+/).filter(Boolean).length;
    return { textContent, wordCount };
  }
}
