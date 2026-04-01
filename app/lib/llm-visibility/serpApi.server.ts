import envVars from "~/lib/envVars.server";

const ENDPOINT = "https://serpapi.com/search";

/**
 * Uses the SerpAPI to fetch organic results for a given query and engine.
 *
 * @param query - The query to search for.
 * @param engine - The engine to use for the search.
 * @param timeout - The timeout for the search.
 * @returns The organic results for the query. Includes citations, extra queries, text, and usage.
 *
 * @see https://serpapi.com/bing-copilot-api
 * @see https://serpapi.com/bing-search-api
 * @see https://serpapi.com/google-ai-mode-api
 * @see https://serpapi.com/search-api
 */
export async function fetchOrganicResults({
  query,
  engine,
  timeout,
}: {
  timeout: number;
  query: string;
  engine: "google" | "bing" | "bing_copilot" | "google_ai_mode";
}): Promise<string[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("engine", engine);
  url.searchParams.set("api_key", envVars.SERPAPI_API_KEY ?? "");

  const signal = timeout > 0 ? AbortSignal.timeout(timeout) : undefined;
  const response = await fetch(url, signal ? { signal } : {});
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpApi error ${response.status}: ${text}`);
  }
  const json = (await response.json()) as {
    organic_results?: { link: string }[];
  };
  return json.organic_results?.map(({ link }) => link) ?? [];
}
