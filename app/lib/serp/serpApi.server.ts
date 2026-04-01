import envVars from "~/lib/envVars.server";

const ENDPOINT = "https://serpapi.com/search";

async function serpApiGet(params: Record<string, string>): Promise<unknown> {
  const url = new URL(ENDPOINT);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  url.searchParams.set("api_key", envVars.SERPAPI_API_KEY ?? "");

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpApi error ${response.status}: ${text}`);
  }
  return response.json();
}

export async function fetchOrganicResults(
  keyword: string,
  engine: "google" | "bing",
): Promise<string[]> {
  const json = (await serpApiGet({ engine, q: keyword, num: "10" })) as {
    organic_results?: { link: string }[];
  };
  return (json.organic_results ?? []).map((r) => r.link);
}

export default async function fetchAioResults(
  keyword: string,
): Promise<{ aioPresent: boolean; citations: string[] }> {
  const json = (await serpApiGet({
    engine: "google",
    q: keyword,
    num: "10",
  })) as {
    ai_overview?: { references?: { link: string }[] };
  };
  const aio = json.ai_overview;
  if (!aio) return { aioPresent: false, citations: [] };

  return {
    aioPresent: true,
    citations: (aio.references ?? []).map((r: { link: string }) => r.link),
  };
}
