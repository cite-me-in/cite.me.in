import envVars from "~/lib/envVars.server";

const ENDPOINT =
  "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";

export default async function fetchAioResults(
  keyword: string,
): Promise<{ aioPresent: boolean; citations: string[] }> {
  const credentials = btoa(
    `${envVars.DATAFORSEO_LOGIN}:${envVars.DATAFORSEO_PASSWORD}`,
  );

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      { keyword, location_code: 2840, language_code: "en", depth: 10 },
    ]),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DataForSEO error ${response.status}: ${text}`);
  }

  const json = await response.json();
  const items: { type: string; references?: { url: string }[] }[] =
    json.tasks?.[0]?.result?.[0]?.items ?? [];

  const aio = items.find((item) => item.type === "ai_overview");
  if (!aio) return { aioPresent: false, citations: [] };

  return {
    aioPresent: true,
    citations: (aio.references ?? []).map((r) => r.url),
  };
}
