import { AlertCircleIcon } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Alert, AlertTitle } from "~/components/ui/Alert";
import { Input } from "~/components/ui/Input";
import type { action } from "./route";
import TrashButton from "./TrashButton";

export default function SingleQuery({
  id,
  group,
  query,
}: {
  id: string;
  group: string;
  query: string;
}) {
  const updateFetcher = useFetcher<typeof action>();
  const deleteFetcher = useFetcher<typeof action>();
  const [value, setValue] = useState(query);

  return (
    <li className="group/row space-y-0.5">
      <div className="flex items-center gap-1">
        <Input
          aria-label="Query text"
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter query…"
          onBlur={() => {
            if (value === query) return;
            void updateFetcher.submit(
              { _intent: "update-query", id, query: value },
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
                void updateFetcher.submit(
                  { _intent: "add-query", group },
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
          value={value}
          variant="ghost"
        />
        <TrashButton
          onClick={() => {
            if (
              confirm(
                `Delete query "${query}" from group "${group}"? This cannot be undone.`,
              )
            )
              void deleteFetcher.submit(
                { _intent: "delete-query", id },
                { method: "post" },
              );
          }}
          title="Delete this query"
        />
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
