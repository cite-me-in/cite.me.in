import { useEffect, useRef, useState } from "react";
import { redirect, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import Spinner from "~/components/ui/Spinner";
import { requireSiteAccess } from "~/lib/auth.server";
import { getStatus } from "~/lib/setupProgress.server";
import type { Route } from "./+types/route";

export const handle = { siteNav: true };

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Setting up ${params.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site, user } = await requireSiteAccess({
    domain: params.domain,
    request,
  });
  const status = await getStatus(site.id, user.id);
  if (status === "complete") throw redirect(`/site/${params.domain}/citations`);
  return { domain: params.domain, needsStart: status === null };
}

export default function SetupPage({ loaderData }: Route.ComponentProps) {
  const { domain, needsStart } = loaderData;
  const navigate = useNavigate();

  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
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
  useEffect(() => {
    if (done) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(
          `/site/${domain}/setup/status?offset=${offsetRef.current}`,
        );
        const data: { lines: string[]; done: boolean; nextOffset: number } =
          await res.json();
        if (data.lines.length > 0) {
          setLines((prev) => [...prev, ...data.lines]);
          offsetRef.current = data.nextOffset;
        }
        if (data.done) setDone(true);
      } catch {
        // Network hiccup — keep polling.
      }
    }, 2_000);
    return () => clearInterval(id);
  }, [done, domain]);

  // Auto-scroll log to bottom.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  // Redirect to citations after pipeline completes.
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(
      () => navigate(`/site/${domain}/citations`),
      2_000,
    );
    return () => clearTimeout(timer);
  }, [done, domain, navigate]);

  return (
    <Main variant="wide">
      <div>
        <h1 className="font-heading text-3xl">Setting up {domain}</h1>
        <p className="mt-1 text-base text-foreground/60">
          {done
            ? "All done — redirecting to your citations…"
            : "Crawling your site and querying AI platforms. This takes about a minute."}
        </p>
      </div>

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
            className="h-96 overflow-y-auto rounded border border-border bg-muted p-4 font-mono text-sm leading-relaxed"
          >
            {lines.length === 0 && !done && (
              <span className="text-foreground/40">Starting…</span>
            )}
            {lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {done && (
              <div className="mt-2 font-semibold text-green-700">
                ✓ Redirecting to citations…
              </div>
            )}
          </pre>
        </CardContent>
      </Card>
    </Main>
  );
}
