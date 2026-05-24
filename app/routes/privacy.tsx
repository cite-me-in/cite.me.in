import { Link } from "react-router";
import remarkGfm from "remark-gfm";
import { Streamdown } from "streamdown";
import Main from "~/components/ui/Main";
import privacy from "~/data/privacy.md?raw";
import type { Route } from "./+types/privacy";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Privacy Policy | Cite.me.in" },
    { name: "description", content: "Read the Cite.me.in Privacy Policy." },
  ];
}

export function links(): Route.LinkDescriptors {
  return [
    {
      rel: "alternate",
      type: "text/markdown",
      title: "Markdown version",
      href: "/privacy.md",
    },
    {
      rel: "alternate",
      type: "text/plain",
      title: "Full site content (llms-full.txt)",
      href: "/llms-full.txt",
    },
  ];
}

export default function PrivacyPolicy() {
  return (
    <Main variant="prose">
      <article>
        <Streamdown
          mode="static"
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ children, href }) => (href ? <Link to={href}>{children}</Link> : children),
          }}
        >
          {privacy}
        </Streamdown>
      </article>
    </Main>
  );
}
