import { HeartIcon } from "lucide-react";
import remarkGfm from "remark-gfm";
import { Streamdown } from "streamdown";
import { ActiveLink } from "~/components/ui/ActiveLink";
import LoadingImage from "~/components/ui/LoadingImage";
import { type BlogPost, loadBlogPost } from "~/lib/blogPosts.server";
import externalLink from "~/lib/externalLink";
import { formatDateMed } from "~/lib/temporal";
import type { Route } from "./+types/blog.$slug";

export async function loader({ params }: Route.LoaderArgs) {
  try {
    return await loadBlogPost(params.slug);
  } catch {
    throw new Response("Not Found", { status: 404 });
  }
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  if (!loaderData) return [];
  const { slug, published, summary, title } = loaderData;
  return [
    { title: `${title} | Cite.me.in` },
    { name: "description", content: summary },
    { property: "og:title", content: title },
    { property: "og:description", content: summary },
    { property: "og:type", content: "article" },
    {
      property: "og:url",
      content: new URL(
        `/blog/${slug}`,
        import.meta.env.VITE_APP_URL,
      ).toString(),
    },
    {
      property: "og:image",
      content: new URL(
        `/blog/${loaderData.image}`,
        import.meta.env.VITE_APP_URL,
      ).toString(),
    },
    { property: "og:published_time", content: published },
    { name: "robots", content: "index, follow" },
  ];
}

export default function Post({ loaderData }: { loaderData: BlogPost }) {
  const { alt, body, image, slug, published, summary, title } = loaderData;
  const faqItems = parseFAQ(body);
  const url = new URL(`/blog/${slug}`, import.meta.env.VITE_APP_URL).toString();
  return (
    <main
      className="min-h-screen bg-[hsl(60,100%,99%)] px-4 py-12"
      aria-label={title}
    >
      <article className="prose prose-lg mx-auto max-w-4xl rounded-md border-black bg-white md:border-2 md:p-8 md:shadow-[8px_8px_0px_0px_black]">
        <h1>{title}</h1>

        <LoadingImage
          alt={alt}
          minHeight={300}
          maxHeight={600}
          src={new URL(
            `/blog/${image}`,
            import.meta.env.VITE_APP_URL,
          ).toString()}
        />

        <p className="prose prose-lg mx-auto text-gray-400 text-md italic">
          {summary}
        </p>
        <Streamdown
          className="prose prose-lg mx-auto"
          components={{
            a: ({ children, href }) => (
              <ActiveLink
                rel="noopener"
                target="_blank"
                to={externalLink(href ?? "")}
              >
                {children}
              </ActiveLink>
            ),
          }}
          controls={{ code: false, mermaid: false, table: false }}
          mode="static"
          remarkPlugins={[remarkGfm]}
        >
          {body}
        </Streamdown>

        <p className="flex items-center gap-2 pt-8 text-base text-gray-500">
          <HeartIcon className="h-4 w-4 text-red-500" fill="currentColor" />
          <span>
            Brought to you by{" "}
            <ActiveLink variant="silent" to={import.meta.env.VITE_APP_URL}>
              Cite.me.in
            </ActiveLink>{" "}
            on {formatDateMed(published)}
          </span>
        </p>

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Article",
                "@id": url,
                author: {
                  "@type": "Organization",
                  name: "Cite.me.in",
                  url: import.meta.env.VITE_APP_URL,
                },
                datePublished: published,
                dateModified: published,
                inLanguage: "en-US",
                name: title,
                primaryImageOfPage: image
                  ? {
                      "@id": new URL(
                        `/blog/${image}`,
                        import.meta.env.VITE_APP_URL,
                      ).toString(),
                      "@type": "ImageObject",
                      caption: alt,
                      contentUrl: new URL(
                        `/blog/${image}`,
                        import.meta.env.VITE_APP_URL,
                      ).toString(),
                    }
                  : undefined,
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: import.meta.env.VITE_APP_URL,
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Blog",
                    item: new URL(
                      "/blog",
                      import.meta.env.VITE_APP_URL,
                    ).toString(),
                  },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: title,
                    item: url,
                  },
                ],
              },
            ],
          })}
        </script>
        {faqItems && faqItems.length > 0 && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqItems.map(({ question, answer }) => ({
                "@type": "Question",
                name: question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: answer,
                },
              })),
            })}
          </script>
        )}
      </article>
    </main>
  );
}

function parseFAQ(body: string): { question: string; answer: string }[] | null {
  const faqMatch = body.match(/## FAQ:?[\s\S]*$/i);
  if (!faqMatch) return null;

  const faqSection = faqMatch[0];
  const qaPattern = /###\s+([^\n]+)\n\n((?:(?!###)[\s\S])+?)(?=\n###|$)/gi;
  const matches = [...faqSection.matchAll(qaPattern)];

  if (matches.length === 0) return null;

  return matches.map((match) => ({
    question: match[1].trim(),
    answer: match[2].replaceAll(/\n/g, " ").trim(),
  }));
}
