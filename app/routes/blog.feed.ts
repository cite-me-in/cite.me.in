import { Feed } from "feed";
import { marked } from "marked";
import { recentBlogPosts } from "~/lib/blogPosts.server";
import logError from "~/lib/logError.server";

export async function loader() {
  try {
    const feed = new Feed({
      author: {
        email: import.meta.env.VITE_EMAIL_FROM,
        name: "Cite.me.in",
      },
      copyright: "Copyright 2026 Cite.me.in",
      description:
        "Insights and guides on LLM citation visibility, AI search optimization, and monitoring your brand's presence in AI-generated responses.",
      favicon: new URL("/favicon.ico", import.meta.env.VITE_APP_URL).toString(),
      feedLinks: {
        atom: new URL("/blog/feed", import.meta.env.VITE_APP_URL).toString(),
      },
      id: import.meta.env.VITE_APP_URL,
      image: new URL("/og-image.png", import.meta.env.VITE_APP_URL).toString(),
      language: "en-US",
      link: new URL("/blog/feed", import.meta.env.VITE_APP_URL).toString(),
      title: "The Cite.me.in Blog",
      updated: new Date(),
    });

    const blogPosts = await recentBlogPosts();
    const recent = blogPosts.slice(0, 10); // Take most recent 10

    // Blog post entries for feed
    for (const {
      body,
      slug,
      published,
      summary,
      title,
      image,
      alt,
    } of recent) {
      const imageURL = new URL(
        `/blog/${image}`,
        import.meta.env.VITE_APP_URL,
      ).toString();
      const content =
        `<img src="${imageURL}" alt="${alt}" />` +
        (await marked.parse(body, { gfm: true }));
      const publishedDate = new Date(published);
      feed.addItem({
        content,
        date: publishedDate,
        description: summary,
        id: new URL(`/blog/${slug}`, import.meta.env.VITE_APP_URL).toString(),
        image: imageURL,
        link: new URL(`/blog/${slug}`, import.meta.env.VITE_APP_URL).toString(),
        published: publishedDate,
        title: title,
      });
    }

    return new Response(feed.atom1(), {
      headers: {
        "Content-Type": "application/atom+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    logError(error);
    throw new Response("Internal Server Error", { status: 500 });
  }
}
