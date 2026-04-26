import { AlertCircleIcon, PlusIcon, SparklesIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { twMerge } from "tailwind-merge";
import { Alert, AlertTitle } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import type { action } from "./route";

/**
 * A component that displays suggested queries for a site. Starts with a button
 * to suggest queries, and then displays the suggestions if they are available.
 *
 * @returns A component that displays suggested queries
 */
export default function SuggestedQueries() {
  const fetcher = useFetcher<typeof action>();
  const [dismissed, setDismissed] = useState(false);

  const isLoading = fetcher.state !== "idle";
  const data = fetcher.data;
  const suggestions =
    !dismissed && data && "suggestions" in data ? data.suggestions : undefined;
  const error =
    fetcher.state === "idle" && data && !data.ok ? data.error : undefined;

  // Group suggestions by group and sort by group/group's queries
  const groupedSuggestions = suggestions
    ? [...suggestions]
        .sort(
          (a, b) =>
            a.group.localeCompare(b.group) || a.query.localeCompare(b.query),
        )
        .reduce(
          (acc, suggestion) => {
            if (!acc[suggestion.group]) {
              acc[suggestion.group] = [];
            }
            acc[suggestion.group].push(suggestion);
            return acc;
          },
          {} as Record<string, typeof suggestions>,
        )
    : {};

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="outline">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}

      {suggestions ? (
        <AllSuggestions
          groupedSuggestions={groupedSuggestions}
          setDismissed={setDismissed}
        />
      ) : (
        <AskForSuggestionsButton
          isLoading={isLoading}
          suggestQueries={() => {
            setDismissed(false);
            void fetcher.submit({ _intent: "suggest" }, { method: "post" });
          }}
        />
      )}
    </div>
  );
}

function AllSuggestions({
  groupedSuggestions,
  setDismissed,
}: {
  groupedSuggestions: Record<string, { group: string; query: string }[]>;
  setDismissed: (dismissed: boolean) => void;
}) {
  return (
    <Card variant="yellow">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold">Suggested queries</p>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setDismissed(true)}
            title="Dismiss suggestions"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        {Object.entries(groupedSuggestions).map(([group, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={group} className="space-y-1">
              <p className="text-foreground/50 text-base tracking-wide uppercase">
                {group}
              </p>
              <ul className="space-y-2">
                {items.map((s) => (
                  <SingleSuggestion key={s.query} suggestion={s} />
                ))}
              </ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SingleSuggestion({
  suggestion,
}: {
  suggestion: { group: string; query: string };
}) {
  const addFetcher = useFetcher<typeof action>();
  const added = addFetcher.data?.ok === true;

  return (
    <li className="flex items-center gap-2 text-base">
      <span className="text-foreground/80 flex-1">{suggestion.query}</span>
      <Button
        variant="outline"
        size="sm"
        type="button"
        disabled={added || addFetcher.state !== "idle"}
        onClick={() =>
          addFetcher.submit(
            {
              _intent: "add-query",
              group: suggestion.group,
              query: suggestion.query,
            },
            { method: "post" },
          )
        }
        title="Add this suggestion to your queries"
      >
        {added ? (
          "Added"
        ) : addFetcher.state !== "idle" ? (
          <div className="border-foreground/20 border-t-foreground h-3 w-3 animate-spin rounded-full border" />
        ) : (
          <PlusIcon className="h-3 w-3" />
        )}
      </Button>
    </li>
  );
}

function AskForSuggestionsButton({
  isLoading,
  suggestQueries,
}: {
  isLoading: boolean;
  suggestQueries: () => void;
}) {
  return (
    <div className="flex justify-end">
      <Button
        variant="outline"
        size="sm"
        type="button"
        disabled={isLoading}
        onClick={suggestQueries}
        title="Use AI to suggest queries for this site"
      >
        <SparklesIcon
          className={twMerge(isLoading ? "animate-spin" : "", "size-4")}
        />
        {isLoading ? "Generating…" : "Suggest queries"}
      </Button>
    </div>
  );
}
