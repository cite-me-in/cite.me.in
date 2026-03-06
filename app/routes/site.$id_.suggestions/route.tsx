import { captureException } from "@sentry/react-router";
import { groupBy, sortBy } from "es-toolkit";
import { AlertCircleIcon, CoffeeIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { redirect, useFetcher } from "react-router";
import z from "zod";
import { ActiveLink } from "~/components/ui/ActiveLink";
import { Alert, AlertTitle } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import Spinner from "~/components/ui/Spinner";
import addSiteQueries from "~/lib/addSiteQueries";
import { requireUser } from "~/lib/auth.server";
import defaultQueryCategories from "~/lib/llm-visibility/defaultQueryCategories";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const suggestions = await prisma.siteQuerySuggestion.findMany({
    where: { siteId: params.id },
  });
  if (suggestions.length === 0) throw redirect(`/site/${params.id}/queries`);
  return { siteId: params.id, suggestions };
}

export function meta(): Route.MetaDescriptors {
  return [{ title: "Add a Site | CiteUp" }];
}

type Suggestion = { group: string; query: string };

type ActionResult =
  | { error: string }
  | { siteId: string }
  | { siteId: string; suggestions: Suggestion[] };

export async function action({ request }: Route.ActionArgs) {
  try {
    const user = await requireUser(request);
    const form = await request.formData();

    const siteId = form.get("siteId")?.toString() ?? "";
    const site = await prisma.site.findFirst({
      where: { id: siteId, accountId: user.accountId },
    });
    if (!site) return { error: "Site not found" };

    const raw = form.get("queries")?.toString() ?? "[]";
    const { error, data: queries } = z
      .array(
        z.object({
          group: z.string(),
          query: z.string(),
        }),
      )
      .safeParse(JSON.parse(raw));
    if (error) throw new Error(error.message);
    await addSiteQueries(site, queries);
    return redirect(`/site/${site.id}`);
  } catch (error) {
    captureException(error);
    return {
      error: "An error occurred while saving the queries. Please try again.",
    };
  }
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<ActionResult>();

  const [suggestions, setSuggestions] = useState<
    { id: string; group: string; query: string }[]
  >(loaderData.suggestions);
  const nonEmpty = suggestions.filter((q) => q.query.trim());
  const groupedQueries = sortBy(
    Object.entries(groupBy(suggestions, (s) => s.group)),
    [([group]) => group],
  );
  const isProcessing = fetcher.state !== "idle";

  function updateQuery(id: string, query: string) {
    setSuggestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, query } : q)),
    );
  }

  function removeQuery(id: string) {
    setSuggestions((prev) => prev.filter((q) => q.id !== id));
  }

  function addQuery(group: string) {
    const id = crypto.randomUUID();
    setSuggestions((prev) => [...prev, { id, group, query: "" }]);
    setTimeout(() => {
      document.getElementById(`query-${id}`)?.focus();
    }, 0);
  }

  function handleSave() {
    fetcher.submit(
      {
        siteId: loaderData.siteId,
        queries: JSON.stringify(
          nonEmpty.map(({ group, query }) => ({ group, query })),
        ),
      },
      { method: "post" },
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-12">
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
                {defaultQueryCategories.find(
                  (c: { group: string }) => c.group === group,
                )?.intent ?? group}
              </p>
              <ul className="space-y-1">
                {queries.map(({ query, id }, pos) => (
                  <li key={id} className="flex items-center gap-2">
                    <Input
                      id={`query-${id}`}
                      variant="ghost"
                      aria-label={`${group} — query ${pos + 1}`}
                      className="flex-1"
                      value={query}
                      onChange={(e) => updateQuery(id, e.target.value)}
                      onKeyUp={(e) => {
                        if (e.key === "Enter") addQuery(group);
                      }}
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

      <div className="flex items-center justify-between gap-4">
        <Button
          onClick={handleSave}
          disabled={nonEmpty.length === 0 || isProcessing}
        >
          {isProcessing && <Spinner />}
          {isProcessing ? "Saving…" : "Save queries"}
        </Button>
        <ActiveLink
          to={`/site/${loaderData.siteId}`}
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
            Be patient, nothing will happen for a few seconds. We're going to
            check these queries against the domain, asking Claude, OpenAI,
            Google, and Perplexity to see if they return any citations. Keep
            this page open to see the progress.
          </span>
        </p>
      )}
    </main>
  );
}
