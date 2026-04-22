import getSitemapRoutes from "~/lib/sitemapRoutes";

export async function loader() {
  const sitemapRoutes = await getSitemapRoutes();
  return new Response(sitemapRoutes.join("\n"), {
    headers: { "Content-Type": "text/plain" },
  });
}
