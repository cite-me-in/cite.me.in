import { crawl } from "./crawl";

export async function fetchSiteContent({
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
  try {
    return await crawl({ domain, maxWords, maxPages, maxSeconds });
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Error(`I couldn't fetch the main page of ${domain}`);
  }
}
