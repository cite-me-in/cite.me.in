import { Link } from "react-router";
import remarkGfm from "remark-gfm";
import { Streamdown } from "streamdown";
import { generateApiDocsMarkdown } from "~/lib/api/docs.server";
import { generateOpenApiSpec } from "~/lib/api/openapi";
import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "API Documentation | Cite.me.in" },
    {
      name: "description",
      content: "Monitoring API reference for cite.me.in — endpoints, parameters, and examples.",
    },
  ];
}

export async function loader() {
  return {
    markdown: generateApiDocsMarkdown(generateOpenApiSpec()),
  };
}

export default function ApiDocs({ loaderData }: Route.ComponentProps) {
  return (
    <main className="mx-auto w-full bg-white px-6 py-12">
      <article className="mx-auto max-w-5xl">
        <Streamdown
          className="prose prose-lg mx-auto"
          mode="static"
          remarkPlugins={[remarkGfm]}
          controls={{
            code: { copy: true, download: false },
            table: { copy: true, download: false, fullscreen: true },
          }}
          components={{
            a: ({ children, href }) =>
              href?.startsWith("/") ? (
                <Link to={href}>{children}</Link>
              ) : (
                <a href={href}>{children}</a>
              ),
            h3: ({ children }) => (
              <h3 className="mt-8 border-t-2 border-t-gray-400 pt-8 font-bold text-2xl">
                {children}
              </h3>
            ),
            pre: ({ children }) => (
              <pre className="overflow-x-auto bg-gray-100 p-4 font-light font-mono text-black">
                {children}
              </pre>
            ),
            table: ({ children }) => <table className="">{children}</table>,
            thead: ({ children }) => (
              <thead className="border-b-2 border-b-gray-600">{children}</thead>
            ),
            code: ({ children }) => (
              <code className="font-light font-mono before:hidden after:hidden">{children}</code>
            ),
          }}
        >
          {loaderData.markdown}
        </Streamdown>
      </article>
    </main>
  );
}
