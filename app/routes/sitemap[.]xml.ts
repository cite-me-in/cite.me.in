import { generateRemixSitemap } from "@forge42/seo-tools/remix/sitemap";
import { recentBlogPosts } from "~/lib/blogPosts.server";

export async function loader() {
  const sitemap = await generateRemixSitemap({
    domain: "https://citeup.com",
    ignore: ["*/\\*", "/error", "/.well-known/*"],
    routes: { ...routes, ...(await blogRoutes()), ...(await allOtherRoutes()) },
  });
  return new Response(sitemap, {
    headers: { "Content-Type": "application/xml" },
  });
}

const routes = {
  "/": { id: "routes/home/route.tsx", module: "home", path: "/" },
  "/faq": { id: "routes/faq/route.tsx", module: "faq", path: "/faq" },
  "/about": { id: "routes/about/route.tsx", module: "about", path: "/about" },
  "/blog": {
    id: "routes/blog._index.tsx",
    module: "blog",
    path: "/blog",
  },
  "/privacy": {
    id: "routes/privacy/route.tsx",
    module: "privacy",
    path: "/privacy",
  },
  "/terms": { id: "routes/terms/route.tsx", module: "terms", path: "/terms" },
};

async function blogRoutes(): Promise<
  Record<string, { id: string; module: string; path: string }>
> {
  const blogPosts = await recentBlogPosts();
  return Object.fromEntries(
    blogPosts.map((post) => [
      `/blog/${post.slug}`,
      {
        id: "routes/blog.$slug.tsx",
        module: "blog-post",
        path: `/blog/${post.slug}`,
      },
    ]),
  );
}

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
