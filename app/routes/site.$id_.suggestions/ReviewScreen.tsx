import { groupBy, sortBy } from "es-toolkit";
import { CoffeeIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useRef, useState } from "react";
import type { useFetcher } from "react-router";
import { ActiveLink } from "~/components/ui/ActiveLink";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import Spinner from "~/components/ui/Spinner";
import defaultQueryCategories from "~/lib/llm-visibility/defaultQueryCategories";

type Suggestion = { group: string; query: string };

type ActionResult =
  | { error: string }
  | { siteId: string }
  | { siteId: string; suggestions: Suggestion[] };

export default function ReviewScreen({
  siteId,
  initialSuggestions,
  isProcessing,
  fetcher,
}: {
  siteId: string;
  initialSuggestions: { group: string; query: string }[];
  isProcessing: boolean;
  fetcher: ReturnType<typeof useFetcher<ActionResult>>;
}) {
  const nextId = useRef(initialSuggestions.length);
  const [suggestions, setSuggestions] = useState<
    {
      group: string;
      query: string;
      id: number;
    }[]
  >(() => initialSuggestions.map((s, i) => ({ ...s, id: i })));
  const nonEmpty = suggestions.filter((q) => q.query.trim());

  function updateQuery(id: number, query: string) {
    setSuggestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, query } : q)),
    );
  }

  function removeQuery(id: number) {
    setSuggestions((prev) => prev.filter((q) => q.id !== id));
  }

  function addQuery(group: string) {
    setSuggestions((prev) => [
      ...prev,
      { group, query: "", id: nextId.current++ },
    ]);
  }

  function handleSave() {
    fetcher.submit(
      {
        _intent: "save-queries",
        siteId,
        queries: JSON.stringify(
          nonEmpty.map(({ group, query }) => ({ group, query })),
        ),
      },
      { method: "post" },
    );
  }

  const groupedQueries = sortBy(
    Object.entries(groupBy(suggestions, (s) => s.group)),
    [([group]) => group],
  );

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      <div>
        <h1 className="font-heading text-2xl">Review suggested queries</h1>
        <p className="mt-1 text-base text-foreground/60">
          Edit, remove, or add queries before saving. These will be used to
          track your citation visibility across AI platforms.
        </p>
      </div>

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
                      variant="ghost"
                      aria-label={`${group} — query ${pos + 1}`}
                      className="flex-1"
                      value={query}
                      onChange={(e) => updateQuery(id, e.target.value)}
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
          to={`/site/${siteId}`}
          className="text-base text-foreground/60 underline"
        >
          Skip
        </ActiveLink>
      </div>

      <p className="flex flex-row gap-2 text-base text-foreground/60">
        <span>
          <CoffeeIcon className="size-6" />
        </span>
        <span>
          Be patient, nothing will happen for a few minutes. We're going to
          check all these queries against the domain, asking Claude, OpenAI,
          Google, and Perplexity to see if they return any citations. Keep this
          page open to see the progress.
        </span>
      </p>
    </main>
  );
}
