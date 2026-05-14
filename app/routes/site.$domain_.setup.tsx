import { ms } from "convert";
import { useEffect, useRef, useState } from "react";
import { redirect, useNavigate } from "react-router";
import { useInterval } from "usehooks-ts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SiteHeading";
import Spinner from "~/components/ui/Spinner";
import { requireSiteAccess } from "~/lib/auth.server";
import { getStatus } from "~/lib/setupProgress.server";
import type { Route } from "./+types/site.$domain_.setup";

export const handle = { siteNav: true };

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Setting up ${params.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site, user } = await requireSiteAccess({
    domain: params.domain,
    request,
  });
  const status = await getStatus({ siteId: site.id, userId: user.id });
  if (status === "complete") throw redirect(`/site/${params.domain}`);
  return {
    site,
    domain: params.domain,
    needsStart: status === null,
    hasError: status === "error",
  };
}

export default function SetupPage({ loaderData }: Route.ComponentProps) {
  const { domain, needsStart } = loaderData;
  const navigate = useNavigate();

  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(loaderData.hasError);
  const offsetRef = useRef(0);
  const logRef = useRef<HTMLPreElement>(null);

  // Fire worker on mount if not already started.
  useEffect(() => {
    if (!needsStart) return;
    fetch(`/site/${domain}/setup/run`, { method: "POST" }).catch(() => {
      setError(true);
    });
  }, [domain, needsStart]);

  // Poll status endpoint every 2s.
  useInterval(
    async () => {
      try {
        const res = await fetch(`/site/${domain}/setup/status?offset=${offsetRef.current}`);
        const data = (await res.json()) as {
          lines: string[];
          done: boolean;
          nextOffset: number;
        };
        if (data.lines.length > 0) {
          setLines((prev) => [...prev, ...data.lines]);
          offsetRef.current = data.nextOffset;
        }
        if (data.done) setDone(true);
      } catch {
        // Network hiccup — keep polling.
      }
    },
    done || error ? null : ms("2s"),
  );

  // Auto-scroll log to bottom when new lines arrive.
  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines]);

  // Redirect to citations after pipeline completes.
  useEffect(() => {
    if (!done) return;
    setTimeout(() => navigate(`/site/${domain}/citations`), 500);
  }, [done, domain, navigate]);

  return (
    <Main variant="wide">
      <SitePageHeader
        site={loaderData.site}
        title={`Setting up ${domain}`}
        subtitle={
          done
            ? "All done — redirecting to your citations…"
            : "Crawling your site and querying AI platforms. This takes about a minute."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {!done && !error && <Spinner />}
            {done ? "Setup complete" : error ? "Something went wrong" : "Running…"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre
            ref={logRef}
            className="border-border bg-muted text-foreground/60 h-96 overflow-y-auto rounded border p-4 font-mono text-sm leading-relaxed whitespace-break-spaces"
          >
            {lines.length === 0 && !done && <span className="text-foreground/40">Starting…</span>}
            {lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {done && (
              <div className="mt-2 font-semibold text-green-700">✓ Redirecting to citations…</div>
            )}
          </pre>
        </CardContent>
      </Card>
    </Main>
  );
}
