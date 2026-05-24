import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { twMerge } from "tailwind-merge";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardFooter } from "~/components/ui/Card";
import { Textarea } from "~/components/ui/Textarea";
import DeleteSiteButton from "./DeleteSiteButton";
import type { action } from "./route";

export default function SiteContentButton({
  content,
  isOwner,
  domain,
}: {
  content: string;
  isOwner: boolean;
  domain: string;
}) {
  const [showSource, setShowSource] = useState(false);
  const deleteFetcher = useFetcher();

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <Button
          aria-controls="our-source-content"
          aria-expanded={showSource}
          onClick={() => setShowSource((source) => !source)}
          type="button"
          variant="outline"
          size="sm"
        >
          <span>Site content</span>
          <ChevronRightIcon
            className={twMerge(
              "size-4 transition-transform duration-150",
              showSource ? "rotate-90" : "rotate-0",
            )}
          />
        </Button>
        {isOwner && (
          <DeleteSiteButton
            domain={domain}
            isSubmitting={deleteFetcher.state !== "idle"}
            onConfirm={() => deleteFetcher.submit({ intent: "delete-site" }, { method: "post" })}
          />
        )}
      </div>

      {showSource && <EditSourceForm content={content} />}
    </div>
  );
}

function EditSourceForm({ content }: { content: string }) {
  const fetcher = useFetcher<typeof action>();
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setIsSaved(!!(fetcher.data && "ok" in fetcher.data));
  }, [fetcher.data]);

  return (
    <fetcher.Form method="put">
      <Card className="w-full">
        <CardContent>
          <Textarea
            className="h-96"
            defaultValue={content}
            name="content"
            onChange={() => setIsSaved(false)}
          />
        </CardContent>
        <CardFooter>
          <Button disabled={fetcher.state !== "idle"} size="sm" type="submit" variant="default">
            {isSaved && <CheckIcon className="size-4" />}
            {isSaved ? "Saved" : fetcher.state !== "idle" ? "Saving…" : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </fetcher.Form>
  );
}
