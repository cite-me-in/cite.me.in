import debug from "debug";
import { discoverUrls } from "./discover";
import { extractFromHtml, fetchAndExtract } from "./extract";

const logger = debug("fetch");
const CONCURRENCY = 3;

export async function crawl({
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
  const signal = AbortSignal.timeout(maxSeconds * 1_000);
  const base = `https://${domain}`;

  let homepageRes: Response;
  try {
    homepageRes = await fetch(`${base}/`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
      redirect: "follow",
      headers: { Accept: "text/markdown, text/html;q=0.9" },
    });
  } catch {
    throw new Error(`HTTP error fetching ${domain}`);
  }
  if (!homepageRes.ok)
    throw new Error(`HTTP ${homepageRes.status} fetching ${domain}`);

  const homepageBody = await homepageRes.text();
  const homepageContentType = homepageRes.headers.get("content-type") ?? "";
  const homepageIsHtml = homepageContentType.includes("text/html");

  const [{ urls: candidateUrls }, homepageExtraction] = await Promise.all([
    discoverUrls({
      domain,
      homepageHtml: homepageIsHtml ? homepageBody : "",
      signal,
    }),
    Promise.resolve(
      homepageIsHtml
        ? extractFromHtml(homepageBody, base)
        : { title: domain, text: homepageBody },
    ),
  ]);

  const results: { url: string; title: string; text: string }[] = [];

  if (homepageExtraction.text.trim())
    results.push({ url: base, ...homepageExtraction });

  let wordCount = countWords(homepageExtraction.text);
  let pagesFetched = 1;

  const queue = [...candidateUrls];

  async function worker(): Promise<void> {
    while (true) {
      if (signal.aborted || wordCount >= maxWords || pagesFetched >= maxPages)
        break;
      const url = queue.shift();
      if (!url) break;

      pagesFetched++;
      try {
        const result = await fetchAndExtract(url, signal);
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

  const words = combined.split(/\s+/).filter(Boolean);
  logger("[crawl:%s] Crawled %d pages, %d words", domain, results.length, words.length);
  return words.slice(0, maxWords).join(" ");
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
