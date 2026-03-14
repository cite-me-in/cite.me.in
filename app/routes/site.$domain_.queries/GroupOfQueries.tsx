import { AlertCircleIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Alert, AlertTitle } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardFooter } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import SingleQuery from "./SingleQuery";
import TrashButton from "./TrashButton";
import type { action } from "./route";

/**
 * A component that displays a group of queries, including a form to rename the
 * group and a list of queries, each with a form to update the query and a button
 * to delete the query.
 *
 * @param group - The name of the group, e.g. "discovery" or "active_search"
 * @param queries - The queries in the group, each with an id, group, and query
 * @returns A component that displays a group of queries
 */
export default function GroupOfQueries({
  group,
  queries,
}: {
  group: string;
  queries: {
    id: string;
    group: string;
    query: string;
  }[];
}) {
  const renameFetcher = useFetcher<typeof action>();
  const deleteFetcher = useFetcher<typeof action>();
  const addFetcher = useFetcher<typeof action>();
  const [groupName, setGroupName] = useState(group);

  return (
    <Card>
      <CardContent>
        {renameFetcher.data?.ok === false && (
          <Alert variant="outline">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>
              {renameFetcher.data.error ??
                "Failed to rename. Please try again."}
            </AlertTitle>
          </Alert>
        )}
        {deleteFetcher.data?.ok === false && (
          <Alert variant="outline">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>
              {deleteFetcher.data.error ??
                "Failed to delete group. Please try again."}
            </AlertTitle>
          </Alert>
        )}
        {addFetcher.data?.ok === false && (
          <Alert variant="outline">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>
              {addFetcher.data.error ??
                "Failed to add query. Please try again."}
            </AlertTitle>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Input
            aria-label="Group name"
            className="font-bold"
            onBlur={() => {
              if (!groupName.trim() || groupName === group) return;
              renameFetcher.submit(
                {
                  _intent: "rename-group",
                  oldGroup: group,
                  newGroup: groupName.trim(),
                },
                { method: "post" },
              );
            }}
            onChange={(e) => setGroupName(e.target.value)}
            value={groupName}
            variant="ghost"
          />
          <TrashButton
            onClick={() => {
              if (
                confirm(
                  `Delete group "${group}" and all its queries? This cannot be undone.`,
                )
              )
                deleteFetcher.submit(
                  { _intent: "delete-group", group },
                  { method: "post" },
                );
            }}
            title="Delete this group of queries"
          />
        </div>

        <ul className="space-y-0.5">
          {queries.map((q) => (
            <SingleQuery key={q.id} id={q.id} group={q.group} query={q.query} />
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => {
            addFetcher.submit(
              { _intent: "add-query", group },
              { method: "post" },
            );
          }}
          title="Add a query to this group"
        >
          <PlusIcon className="h-4 w-4" />
          Add query
        </Button>
      </CardFooter>
    </Card>
  );
}
