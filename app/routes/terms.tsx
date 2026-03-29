import { Link } from "react-router";
import remarkGfm from "remark-gfm";
import { Streamdown } from "streamdown";
import Main from "~/components/ui/Main";
import terms from "~/data/terms.md?raw";
import type { Route } from "./+types/terms";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Terms of Service | Cite.me.in" },
    { name: "description", content: "Read the Cite.me.in Terms of Service." },
  ];
}

export default function TermsOfService() {
  return (
    <Main variant="prose">
      <article>
        <Streamdown
          mode="static"
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ children, href }) =>
              href ? <Link to={href}>{children}</Link> : children,
          }}
        >
          {terms}
        </Streamdown>
      </article>
    </Main>
  );
}
