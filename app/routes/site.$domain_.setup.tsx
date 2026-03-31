import { ms } from "convert";
import { useEffect, useRef, useState } from "react";
import { redirect, useNavigate } from "react-router";
import { useInterval } from "usehooks-ts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import Main from "~/components/ui/Main";
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
        const res = await fetch(
          `/site/${domain}/setup/status?offset=${offsetRef.current}`,
        );
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: lines triggers the scroll; logRef is stable
  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines]);

  // Redirect to citations after pipeline completes.
  useEffect(() => {
    if (!done) return;
    setTimeout(() => navigate(`/site/${domain}/citations`), ms("2s"));
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
            {done
              ? "Setup complete"
              : error
                ? "Something went wrong"
                : "Running…"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre
            ref={logRef}
            className="h-96 overflow-y-auto whitespace-break-spaces rounded border border-border bg-muted p-4 font-mono text-foreground/60 text-sm leading-relaxed"
          >
            {lines.length === 0 && !done && (
              <span className="text-foreground/40">Starting…</span>
            )}
            {lines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines are append-only, index is stable
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
