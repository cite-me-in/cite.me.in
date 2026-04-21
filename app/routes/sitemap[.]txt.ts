import envVars from "~/lib/envVars.server";

export async function loader() {
  const baseUrl = envVars.VITE_APP_URL;
  const urls = [
    "/",
    "/faq",
    "/about",
    "/privacy",
    "/terms",
    "/docs",
    "/pricing",
  ].map((path) => new URL(path, baseUrl).toString());

  return new Response(urls.join("\n"), {
    headers: { "Content-Type": "text/plain" },
  });
}