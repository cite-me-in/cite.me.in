import envVars from "~/lib/envVars.server";

const ENDPOINT = "https://serpapi.com/search";

export default async function fetchAioResults(
  keyword: string,
): Promise<{ aioPresent: boolean; citations: string[] }> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", keyword);
  url.searchParams.set("api_key", envVars.SERPAPI_API_KEY ?? "");
  url.searchParams.set("num", "10");

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpApi error ${response.status}: ${text}`);
  }

  const json = await response.json();
  const aio = json.ai_overview;
  if (!aio) return { aioPresent: false, citations: [] };

  return {
    aioPresent: true,
    citations: (aio.references ?? []).map((r: { link: string }) => r.link),
  };
}
