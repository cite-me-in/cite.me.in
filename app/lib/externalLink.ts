import envVars from "./envVars";

const { hostname } = new URL(envVars.APP_URL);

export default function externalLink(url: string): string {
  try {
    const proper = new URL(url);
    proper.searchParams.delete("utm_source");
    proper.searchParams.delete("utm_medium");
    proper.searchParams.delete("utm_content");
    proper.searchParams.delete("utm_campaign");
    if (proper.hostname && proper.hostname !== hostname)
      proper.searchParams.set("utm_source", hostname);
    return proper.toString();
  } catch {
    return url;
  }
}
