import { ms } from "convert";
import debug from "debug";
import discoverURLs from "./discover";
import fetchAndExtract from "./extract";

const logger = debug("crawl");
const CONCURRENCY = 3;

export default async function crawl({
  domain,
  maxWords = 5_000,
  maxPages = 20,
  maxSeconds = 10,
}: {
  domain: string;
  maxWords?: number;
  maxPages?: number;
  maxSeconds?: number;
}): Promise<string> {
  const signal = AbortSignal.timeout(maxSeconds * ms("1s"));
  const baseURL = new URL(`https://${domain}/`);
  const results: { url: URL; title: string; text: string }[] = [];

  const llmsText = await fetchLLMsText({ baseURL, signal });
  if (llmsText)
    results.push({ url: baseURL, title: baseURL.hostname, text: llmsText });

  const homepage = await fetchAndExtract({ url: baseURL, signal });
  if (!homepage) throw new Error(`HTTP error fetching ${domain}`);
  results.push({ url: baseURL, ...homepage });

  const urls = await discoverURLs({
    url: baseURL,
    homepage: homepage?.html ?? "",
    signal,
  });

  let wordCount = countWords(homepage.text);
  let pagesFetched = 1;
  const queue = [...urls];

  async function worker(): Promise<void> {
    while (true) {
      if (signal.aborted || wordCount >= maxWords || pagesFetched >= maxPages)
        break;
      const url = queue.shift();
      if (!url) break;

      pagesFetched++;
      try {
        const result = await fetchAndExtract({ url: new URL(url), signal });
        if (result?.text.trim()) {
          wordCount += countWords(result.text);
          results.push({ url, ...result });
        }
      } catch {
        // skip failed pages
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const combined = results
    .map(({ title, text }) => `## ${title}\n\n${text}`)
    .join("\n\n---\n\n");
  logger(
    "[crawl] Crawled %s => %d pages — %d words",
    baseURL.hostname,
    results.length,
    combined.split(/\s+/).filter(Boolean).length,
  );

  // Trim `combined` to `maxWords` words, but preserve spaces and newlines
  let trimmed = "";
  let total = 0;
  // Match non-whitespace sequences (words), but keep all original spacing/newlines.
  combined.replace(/\S+\s*/g, (match) => {
    if (total < maxWords) {
      trimmed += match;
      total += 1;
    }
    return match;
  });
  return trimmed.replace(/\n{2,}/g, "\n\n");
}

/**
 * Fetches the llms.txt file from the given base URL. Returns the content of the
 * file if available.
 *
 * @param base - The base URL to fetch the LLMs text from.
 * @param signal - The abort signal to use to cancel the fetch.
 * @returns The llms.txt file content if available
 */
async function fetchLLMsText({
  baseURL,
  signal,
}: {
  baseURL: URL;
  signal: AbortSignal;
}): Promise<string> {
  try {
    const url = new URL("/llms.txt", baseURL);
    const res = await fetch(url, { signal });
    if (!res.ok) return "";
    const text = await res.text();
    logger("[crawl] Fetched %s: %d bytes", url.href, text.length);
    return text;
  } catch {
    return "";
  }
}

/**
 * Counts the number of words in the given text.
 *
 * @param text - The text to count the words of.
 * @returns The number of words in the text.
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
