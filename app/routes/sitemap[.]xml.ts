import { generateRemixSitemap } from "@forge42/seo-tools/remix/sitemap";

export async function loader() {
  const sitemap = await generateRemixSitemap({
    domain: import.meta.env.VITE_APP_URL,
    ignore: ["*/\\*", "/error", "/.well-known/*"],
    routes: { ...routes, ...(await allOtherRoutes()) },
  });
  return new Response(sitemap, {
    headers: { "Content-Type": "application/xml" },
  });
}

const routes = {
  "/": { id: "routes/home/route.tsx", module: "home", path: "/" },
  "/faq": { id: "routes/faq/route.tsx", module: "faq", path: "/faq" },
  "/about": { id: "routes/about/route.tsx", module: "about", path: "/about" },
  "/privacy": {
    id: "routes/privacy/route.tsx",
    module: "privacy",
    path: "/privacy",
  },
  "/terms": { id: "routes/terms/route.tsx", module: "terms", path: "/terms" },
  "/api-docs": {
    id: "routes/api-docs/route.tsx",
    module: "api-docs",
    path: "/api-docs",
  },
};

async function allOtherRoutes(): Promise<
  Record<string, { id: string; module: string; path: string }>
> {
  const all = await Promise.all([]);
  return Object.fromEntries(
    all
      .flat()
      .map((path) => [
        `routes/${path}`,
        { id: `routes/${path}`, module: path, path: `/${path}` },
      ]),
  );
}
