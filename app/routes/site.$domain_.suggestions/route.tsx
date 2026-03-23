import { groupBy, sortBy } from "es-toolkit";
import { AlertCircleIcon, CoffeeIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { redirect, useFetcher } from "react-router";
import { useInterval } from "usehooks-ts";
import z from "zod";
import { ActiveLink } from "~/components/ui/ActiveLink";
import { Alert, AlertTitle } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import Main from "~/components/ui/Main";
import ProgressIndicator from "~/components/ui/ProgressIndicator";
import Spinner from "~/components/ui/Spinner";
import addSiteQueries from "~/lib/addSiteQueries";
import { requireSiteAccess } from "~/lib/auth.server";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
import queryAccount from "~/lib/llm-visibility/queryAccount";
import queryGroups from "~/lib/llm-visibility/queryGroups";
import logError from "~/lib/logError.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `Suggested Queries — ${loaderData?.site.domain} | Cite.me.in` },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site } = await requireSiteAccess({ domain: params.domain, request });
  const suggestions = await prisma.siteQuerySuggestion.findMany({
    where: { siteId: site.id },
  });
  if (suggestions.length === 0)
    throw redirect(`/site/${params.domain}/queries`);
  return { site, suggestions };
}

export async function action({ params, request }: Route.ActionArgs) {
  try {
    const { site } = await requireSiteAccess({
      domain: params.domain,
      request,
    });

    switch (request.method) {
      case "PUT": {
        const formData = await request.formData();
        const content = formData.get("content")?.toString() ?? "";
        const updatedSite = await prisma.site.update({
          where: { id: site.id },
          data: { content },
        });
        await generateSiteQueries(updatedSite);
        return { ok: true };
      }

      case "POST": {
        const raw = await request.json();
        const queries = z
          .array(z.object({ group: z.string(), query: z.string() }))
          .parse(raw);
        await addSiteQueries(site, queries);
        await queryAccount({
          site,
          queries: queries.filter((q) => q.query.trim()),
        });
        return redirect(`/site/${params.domain}/citations`);
      }
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    logError(error);
    return {
      error: "An error occurred while saving the queries. Please try again.",
    };
  }
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const [suggestions, setSuggestions] = useState<
    { id: string; group: string; query: string }[]
  >(loaderData.suggestions);
  const nonEmpty = suggestions.filter((q) => q.query.trim());
  const groupedQueries = sortBy(
    Object.entries(groupBy(suggestions, (s) => s.group)),
    [([group]) => group],
  );

  const fetcher = useFetcher<typeof action>();
  const isProcessing = fetcher.state !== "idle";

  function addQuery(group: string) {
    const id = crypto.randomUUID();
    setSuggestions((prev) => [...prev, { id, group, query: "" }]);
    setTimeout(() => {
      document.getElementById(`query-${id}`)?.focus();
    }, 0);
  }

  function updateQuery(id: string, query: string) {
    setSuggestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, query } : q)),
    );
  }

  function removeQuery(id: string) {
    setSuggestions((prev) => prev.filter((q) => q.id !== id));
  }

  return (
    <Main variant="wide">
      <div>
        <h1 className="font-heading text-2xl">Review suggested queries</h1>
        <p className="mt-1 text-base text-foreground/60">
          Edit, remove, or add queries before saving. These will be used to
          track your citation visibility across AI platforms.
        </p>
      </div>

      {fetcher.data && "error" in fetcher.data && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>{fetcher.data.error}</AlertTitle>
        </Alert>
      )}

      <div className="space-y-4">
        {groupedQueries.map(([group, queries]) => (
          <Card key={group}>
            <CardContent className="space-y-2">
              <p className="font-heading text-base">
                {queryGroups.find((c: { group: string }) => c.group === group)
                  ?.intent ?? group}
              </p>
              <ul className="space-y-1">
                {queries.map(({ query, id }, pos) => (
                  <li key={id} className="flex items-center gap-2">
                    <Input
                      aria-label={`${group} — query ${pos + 1}`}
                      className="flex-1"
                      id={`query-${id}`}
                      onChange={(e) => updateQuery(id, e.target.value)}
                      onKeyUp={(e) => {
                        if (e.key === "Enter") addQuery(group);
                      }}
                      value={query}
                      variant="ghost"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      aria-label="Remove query"
                      onClick={() => removeQuery(id)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => addQuery(group)}
              >
                <PlusIcon className="h-4 w-4" />
                Add query
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-8">
        <Button
          onClick={() => {
            fetcher.submit(
              nonEmpty.map(({ group, query }) => ({ group, query })),
              {
                method: "post",
                encType: "application/json",
                flushSync: true,
              },
            );
          }}
          disabled={nonEmpty.length === 0 || isProcessing}
        >
          {isProcessing && <Spinner />}
          {isProcessing ? "Saving…" : "Save queries"}
        </Button>

        {isProcessing && <GradualProgress />}

        <ActiveLink
          to={`/site/${loaderData.site.domain}`}
          className="text-base text-foreground/60 underline"
        >
          Skip
        </ActiveLink>
      </div>

      {isProcessing && (
        <p className="flex flex-row items-start gap-2 text-base text-foreground/60">
          <span>
            <CoffeeIcon className="size-6" />
          </span>
          <span>
            Be patient, nothing will happen for a couple of minutes. We're going
            to check these queries against the domain, asking Claude, OpenAI,
            Google, and Perplexity to see if they return any citations. Keep
            this page open to see the progress.
          </span>
        </p>
      )}
    </Main>
  );
}

function GradualProgress({ totalTime = 120_000 }: { totalTime?: number }) {
  const [progress, setProgress] = useState(0);
  const increment = (300 * 100) / totalTime;
  useInterval(() => {
    setProgress((progress) => (progress >= 100 ? 100 : progress + increment));
  }, 100);
  if (import.meta.env.MODE === "test") return null;

  return <ProgressIndicator value={progress} />;
}
