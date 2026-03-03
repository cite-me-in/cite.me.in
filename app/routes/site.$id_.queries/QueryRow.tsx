import { AlertCircleIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Alert, AlertTitle } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import type { action } from "./route";

type SiteQueryRow = {
  id: string;
  group: string;
  query: string;
};

export default function QueryRow({ query }: { query: SiteQueryRow }) {
  const updateFetcher = useFetcher<typeof action>();
  const deleteFetcher = useFetcher<typeof action>();
  const [value, setValue] = useState(query.query);

  return (
    <li className="group/row space-y-0.5">
      <div className="flex items-center gap-1">
        <Input
          aria-label="Query text"
          className="h-auto flex-1 border-transparent bg-transparent px-2 py-1 text-base shadow-none hover:border-border focus-visible:translate-x-0 focus-visible:translate-y-0 focus-visible:border-border focus-visible:shadow-none"
          placeholder="Enter query…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            if (value === query.query) return;
            updateFetcher.submit(
              { _intent: "update-query", id: query.id, query: value },
              { method: "post" },
            );
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // If Enter is pressed, focus the next input if it exists; otherwise, add a new row.
              const li = (e.target as HTMLElement).closest("li");
              const next = li?.nextElementSibling;
              if (next) {
                const input = next.querySelector(
                  'input[aria-label="Query text"]',
                ) as HTMLElement | null;
                if (input) input.focus();
              } else {
                updateFetcher.submit(
                  { _intent: "add-query", group: query.group },
                  { method: "post" },
                );
                // Defer focus until after submit; we can't focus new input synchronously.
                // So, set a short timeout to poll for the new input.
                setTimeout(() => {
                  // get the ul containing this li, then its last child (new li), then its input
                  const li = (e.target as HTMLElement).closest("li");
                  const ul = li?.parentElement;
                  if (ul) {
                    const lastLi = ul.lastElementChild;
                    if (lastLi) {
                      const input = lastLi.querySelector(
                        'input[aria-label="Query text"]',
                      ) as HTMLElement | null;
                      if (input) input.focus();
                    }
                  }
                }, 100);
              }
            }
          }}
        />
        <Button
          variant="ghost"
          className="transition-all hover:border-red-600 hover:shadow-[3px_3px_0px_0px_red] focus-visible:border-red-600 focus-visible:shadow-[3px_3px_0px_0px_red]"
          size="sm"
          type="button"
          aria-label="Delete query"
          onClick={() => {
            if (
              confirm(
                `Delete query "${query.query}" from group "${query.group}"? This cannot be undone.`,
              )
            )
              deleteFetcher.submit(
                { _intent: "delete-query", id: query.id },
                { method: "post" },
              );
          }}
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>
      {updateFetcher.data?.ok === false && (
        <Alert variant="outline">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>
            {updateFetcher.data.error ?? "Failed to save. Please try again."}
          </AlertTitle>
        </Alert>
      )}
      {deleteFetcher.data?.ok === false && (
        <Alert variant="outline">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>
            {deleteFetcher.data.error ?? "Failed to delete. Please try again."}
          </AlertTitle>
        </Alert>
      )}
    </li>
  );
}
