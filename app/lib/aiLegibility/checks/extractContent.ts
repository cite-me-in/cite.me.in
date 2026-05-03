import { Defuddle } from "defuddle/node";
import { parseHTML } from "linkedom";

const MIN_CONTENT_LENGTH = 100;
const MIN_WORD_COUNT = 25;

const SPA_ROOT_IDS = [
  "root", "app", "__next", "__nuxt", "___gatsby", "svelte", "__svelte",
  "react-root", "app-root", "application-root", "__remix", "app-shell",
  "page-mount",
];

function hasParagraphs(text: string): boolean {
  return /\n\s*\n/.test(text);
}

function hasSentenceEndings(text: string): boolean {
  return /[.!?]\s+[A-Z]/.test(text.replace(/[^a-zA-Z0-9.!?]/g, " ").trim());
}

function isSpaShell(html: string): boolean {
  const { document } = parseHTML(html);
  return SPA_ROOT_IDS.some((id) => {
    const div = document.querySelector(`[id="${id}"]`);
    return div !== null;
  }) || (() => {
    const appDiv = document.querySelector('div[class="app"]');
    return appDiv !== null;
  })();
}

function hasHeadings(html: string): boolean {
  const { document } = parseHTML(html);
  const body = document.querySelector("body");
  if (!body) return /<h[1-3][^>]*>/i.test(html);
  const bodyHtml = body.innerHTML;
  return /<h[1-3][^>]*>/i.test(bodyHtml);
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
  const { textContent, wordCount } = await extractContent(html, url);
  const contentLength = textContent.length;

  const isSpaShellResult = isSpaShell(html);
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
    isSpaShell: isSpaShellResult,
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

async function extractContent(
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
