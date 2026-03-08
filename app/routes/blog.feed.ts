import { Feed } from "feed";
import { marked } from "marked";
import { recentBlogPosts } from "~/lib/blogPosts.server";
import captureException from "~/lib/captureException.server";

export async function loader() {
  try {
    const feed = new Feed({
      author: { email: "hello@citeup.com", name: "CiteUp" },
      copyright: "Copyright 2026 CiteUp",
      description:
        "Insights and guides on LLM citation visibility, AI search optimization, and monitoring your brand's presence in AI-generated responses.",
      favicon: "https://citeup.com/favicon.ico",
      feedLinks: { atom: "https://citeup.com/blog/feed" },
      id: "citeup.com",
      image: "https://citeup.com/og-image.png",
      language: "en-US",
      link: "https://citeup.com/blog/feed",
      title: "The CiteUp Blog",
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
      const imageURL = `https://citeup.com/blog/${image}`;
      const content =
        `<img src="${imageURL}" alt="${alt}" />` +
        (await marked.parse(body, { gfm: true }));
      const publishedDate = new Date(published);
      feed.addItem({
        content,
        date: publishedDate,
        description: summary,
        id: `citeup.com:${slug}`,
        image: imageURL,
        link: `https://citeup.com/blog/${slug}`,
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
    captureException(error);
    throw new Response("Internal Server Error", { status: 500 });
  }
}
