import { AlertCircleIcon, PlusIcon, TrashIcon } from "lucide-react";
import { alphabetical, group } from "radashi";
import { useState } from "react";
import { redirect, useFetcher } from "react-router";
import z from "zod";
import { ActiveLink } from "~/components/ui/ActiveLink";
import { Alert, AlertTitle } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SiteHeading";
import Spinner from "~/components/ui/Spinner";
import addSiteQueries from "~/lib/addSiteQueries";
import { requireSiteAccess } from "~/lib/auth.server";
import captureAndLogError from "~/lib/captureAndLogError.server";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
import queryGroups from "~/lib/llm-visibility/queryGroups";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Suggested Queries — ${loaderData?.site.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site } = await requireSiteAccess({ domain: params.domain, request });
  const suggestions = await prisma.siteQuerySuggestion.findMany({
    where: { siteId: site.id },
  });
  if (suggestions.length === 0) throw redirect(`/site/${params.domain}/queries`);
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
        const content = (formData.get("content") as string).trim();
        const updatedSite = await prisma.site.update({
          where: { id: site.id },
          data: { content },
        });
        await generateSiteQueries(updatedSite.id);
        return { ok: true };
      }

      case "POST": {
        const queries = z
          .array(z.object({ group: z.string(), query: z.string() }))
          .parse(await request.json());
        await addSiteQueries(site, queries);
        return redirect(`/site/${params.domain}/citations`);
      }
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    captureAndLogError(error);
    return {
      error: "An error occurred while saving the queries. Please try again.",
    };
  }
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const [suggestions, setSuggestions] = useState<{ id: string; group: string; query: string }[]>(
    loaderData.suggestions,
  );
  const groupedQueries = alphabetical(
    Object.entries(group(suggestions, (s) => s.group)),
    ([g]) => g,
  );

  const nonEmpty = suggestions.filter((s) => s.query.trim());
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
    setSuggestions((prev) => prev.map((q) => (q.id === id ? { ...q, query } : q)));
  }

  function removeQuery(id: string) {
    setSuggestions((prev) => prev.filter((q) => q.id !== id));
  }

  return (
    <Main variant="wide">
      <SitePageHeader
        site={loaderData.site}
        title="Review suggested queries"
        subtitle="Edit, remove, or add queries before saving. These will be used to track your citation visibility across AI platforms."
      />

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
                {queryGroups.find((c: { group: string }) => c.group === group)?.intent ?? group}
              </p>
              <ul className="space-y-1">
                {queries?.map(({ query, id }, pos) => (
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
              <Button variant="outline" size="sm" type="button" onClick={() => addQuery(group)}>
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
            void fetcher.submit(
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

        <ActiveLink
          to={`/site/${loaderData.site.domain}`}
          className="text-foreground/60 text-base underline"
        >
          Skip
        </ActiveLink>
      </div>
    </Main>
  );
}
