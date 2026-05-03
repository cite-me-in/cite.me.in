export function parseLinkHeader(
  linkHeader: string | null,
): { uri: string; params: Record<string, string> }[] {
  if (!linkHeader) return [];
  const results: { uri: string; params: Record<string, string> }[] = [];
  const linkRegex = /<([^>]+)>\s*;\s*(.*?)(?=,\s*<|$)/g;
  const paramRegex = /(\w+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = linkRegex.exec(linkHeader)) !== null) {
    const paramsStr = match[2];
    const params: Record<string, string> = {};
    paramRegex.lastIndex = 0;
    let pm;
    while ((pm = paramRegex.exec(paramsStr)) !== null) params[pm[1]] = pm[2];
    results.push({ uri: match[1], params });
  }
  return results;
}

export async function fetchMarkdownPage(url: string): Promise<{
  ok: boolean;
  contentType: string;
  contentLength: number;
  status: number;
}> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
        Accept: "text/markdown",
      },
      signal: AbortSignal.timeout(10_000),
    });

    const contentType = response.headers.get("Content-Type") ?? "";
    const isMarkdown =
      contentType.startsWith("text/markdown") ||
      contentType.startsWith("text/plain");
    const text = response.ok ? await response.text() : "";
    const contentLength = text.trim().length;

    return {
      ok: response.ok && isMarkdown && contentLength > 50,
      contentType,
      contentLength,
      status: response.status,
    };
  } catch {
    return { ok: false, contentType: "", contentLength: 0, status: 0 };
  }
}

export async function trySitemapUrls<T>(
  urls: string[],
  fetcher: (url: string) => Promise<T>,
  isPassed: (result: T) => boolean,
  buildFallback: (triedUrls: string[]) => T,
): Promise<T> {
  if (urls.length === 1) return fetcher(urls[0]);
  for (const url of urls) {
    const result = await fetcher(url);
    if (isPassed(result)) return result;
  }
  return buildFallback(urls);
}
