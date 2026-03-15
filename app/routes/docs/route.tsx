import { Link } from "react-router";
import remarkGfm from "remark-gfm";
import { Streamdown } from "streamdown";
import { twMerge } from "tailwind-merge";
import Main from "~/components/ui/Main";
import { generateApiDocsMarkdown } from "~/lib/api/docs.server";
import { generateOpenApiSpec } from "~/lib/api/openapi";
import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "API Documentation | Cite.me.in" },
    {
      name: "description",
      content:
        "Monitoring API reference for cite.me.in — endpoints, parameters, and examples.",
    },
  ];
}

export async function loader() {
  return {
    markdown: generateApiDocsMarkdown(
      generateOpenApiSpec() as Parameters<typeof generateApiDocsMarkdown>[0],
    ),
  };
}

export default function ApiDocs({ loaderData }: Route.ComponentProps) {
  return (
    <Main variant="prose">
      <article className={twMerge("**:data-[streamdown=code-block]:my-0")}>
        <Streamdown
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
          }}
        >
          {loaderData.markdown}
        </Streamdown>
      </article>
    </Main>
  );
}
