import { Defuddle } from "defuddle/node";
import { parseHTML } from "linkedom";

export async function markdownMiddleware(
  { request }: { request: Request },
  next: () => Promise<Response>,
) {
  const url = new URL(request.url);
  const isMdExtension = url.pathname.endsWith(".md");
  const acceptsMarkdown = request.headers
    .get("accept")
    ?.includes("text/markdown");

  if (!isMdExtension && !acceptsMarkdown) return next();

  if (isMdExtension) {
    const htmlURL = new URL(url.pathname.replace(/\.md$/, ""), request.url);
    const htmlResponse = await fetch(htmlURL.toString());
    return htmlResponse.ok
      ? convertHTMLToMarkdown(htmlResponse)
      : new Response(htmlResponse.statusText, { status: htmlResponse.status });
  } else {
    const response = await next();
    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("text/html")
      ? convertHTMLToMarkdown(response)
      : response;
  }
}

async function convertHTMLToMarkdown(response: Response): Promise<Response> {
  const html = await response.text();
  if (html.includes("<title>404") || html.includes("Page not found"))
    return new Response("Not Found", { status: 404 });

  const { document } = parseHTML(html);
  const result = await Defuddle(document, response.url, { markdown: true });
  const markdown = result.contentMarkdown || result.content;

  if (!markdown) return new Response("Not Found", { status: 404 });

  return new Response(markdown, {
    status: response.status,
    headers: {
      ...response.headers,
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
