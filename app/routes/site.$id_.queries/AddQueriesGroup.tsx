import { AlertCircleIcon, PlusIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Alert, AlertTitle } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import type { action } from "./route";

export default function AddQueriesGroup() {
  const addGroupFetcher = useFetcher<typeof action>();
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const newGroupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAddingGroup) newGroupInputRef.current?.focus();
  }, [isAddingGroup]);

  function submitNewGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    addGroupFetcher.submit(
      { _intent: "add-group", group: name },
      { method: "post" },
    );
    setIsAddingGroup(false);
    setNewGroupName("");
  }

  function cancelAddingGroup() {
    setIsAddingGroup(false);
    setNewGroupName("");
    addGroupFetcher.reset();
  }

  return (
    <>
      {isAddingGroup ? (
        <div className="flex items-center gap-2">
          <Input
            ref={newGroupInputRef}
            placeholder="Group name, e.g. 1. discovery"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewGroup();
              if (e.key === "Escape") cancelAddingGroup();
            }}
            onBlur={submitNewGroup}
          />
          <Button
            onClick={cancelAddingGroup}
            title="Cancel adding a group of queries"
            type="button"
            variant="ghost"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setIsAddingGroup(true)}
            title="Add a group of queries"
          >
            <PlusIcon className="h-4 w-4" />
            Add group
          </Button>
        </div>
      )}

      {addGroupFetcher.data?.ok === false && (
        <Alert variant="outline">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>
            {addGroupFetcher.data.error ??
              "Failed to add group. Please try again."}
          </AlertTitle>
        </Alert>
      )}
    </>
  );
}
