import { loadBlogPost } from "~/lib/blogPosts.server";
import { formatDateHuge } from "~/lib/temporal";
import type { Route } from "./+types/blog.$slug[.]md";

export async function loader({ params }: Route.LoaderArgs) {
  try {
    const { slug } = params;
    const post = await loadBlogPost(slug);
    const md = `
# ${post.title}

**Published:** ${formatDateHuge(post.published)}

---

![${post.alt}](/blog/${post.image})

${post.body}

---

**More blog posts:** [All blog posts](/blog/sitemap.md)
    `.trim();
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown",
        Link: `<${new URL(`/blog/${slug}`, import.meta.env.VITE_APP_URL).toString()}>; rel="alternate"; type="text/html"`,
      },
    });
  } catch {
    throw new Response("Not Found", { status: 404 });
  }
}
