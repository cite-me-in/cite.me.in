import { Feed } from "feed";
import { marked } from "marked";
import { recentBlogPosts } from "~/lib/blogPosts.server";
import captureException from "~/lib/captureException.server";
import envVars from "~/lib/envVars";

export async function loader() {
  try {
    const feed = new Feed({
      author: { email: "hello@cite.me.in", name: "Cite.me.in" },
      copyright: "Copyright 2026 Cite.me.in",
      description:
        "Insights and guides on LLM citation visibility, AI search optimization, and monitoring your brand's presence in AI-generated responses.",
      favicon: `${envVars.APP_URL}/favicon.ico`,
      feedLinks: { atom: `${envVars.APP_URL}/blog/feed` },
      id: envVars.APP_URL,
      image: `${envVars.APP_URL}/og-image.png`,
      language: "en-US",
      link: `${envVars.APP_URL}/blog/feed`,
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
      const imageURL = `${envVars.APP_URL}/blog/${image}`;
      const content =
        `<img src="${imageURL}" alt="${alt}" />` +
        (await marked.parse(body, { gfm: true }));
      const publishedDate = new Date(published);
      feed.addItem({
        content,
        date: publishedDate,
        description: summary,
        id: `${envVars.APP_URL}:${slug}`,
        image: imageURL,
        link: `${envVars.APP_URL}/blog/${slug}`,
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
