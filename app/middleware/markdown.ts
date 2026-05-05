import { Defuddle } from "defuddle/node";
import { parseHTML } from "linkedom";

export async function markdownMiddleware(
  { request }: { request: Request },
  next: () => Promise<Response>,
) {
  const url = new URL(request.url);

  if (!url.pathname.endsWith(".md")) return next();

  const htmlPath = url.pathname.replace(/\.md$/, "");
  const htmlUrl = new URL(htmlPath, request.url);

  try {
    const htmlResponse = await fetch(htmlUrl.toString());

    if (!htmlResponse.ok) return new Response("Not Found", { status: 404 });

    const html = await htmlResponse.text();

    if (html.includes("<title>404") || html.includes("Page not found"))
      return new Response("Not Found", { status: 404 });

    const { document } = parseHTML(html);
    const result = await Defuddle(document, htmlUrl.toString(), {
      markdown: true,
    });
    const markdown = result.contentMarkdown || result.content;

    if (!markdown) return new Response("Not Found", { status: 404 });

    return new Response(markdown, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error processing .md request:", error);
    return new Response("Not Found", { status: 404 });
  }
}
