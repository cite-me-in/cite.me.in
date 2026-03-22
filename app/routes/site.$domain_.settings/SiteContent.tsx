import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { twMerge } from "tailwind-merge";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardFooter } from "~/components/ui/Card";
import { Textarea } from "~/components/ui/Textarea";
import type { action } from "./route";

export default function SiteContent({ content }: { content: string }) {
  const [showSource, setShowSource] = useState(false);

  return (
    <div className="my-6 space-y-4">
      <Button
        aria-controls="our-source-content"
        aria-expanded={showSource}
        onClick={() => setShowSource((source) => !source)}
        type="button"
        variant="outline"
      >
        <span>Site content</span>
        <ChevronRightIcon
          className={twMerge(
            "size-4 transition-transform duration-150",
            showSource ? "rotate-90" : "rotate-0",
          )}
        />
      </Button>

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
      <Card>
        <CardContent>
          <Textarea
            className="h-96"
            defaultValue={content}
            name="content"
            onChange={() => setIsSaved(false)}
          />
        </CardContent>
        <CardFooter>
          <p className="mt-2 text-foreground/60 text-sm">
            This is content we retrieved from the site. We use this content to
            suggest citation queries.
          </p>
          <Button
            disabled={fetcher.state !== "idle"}
            size="sm"
            type="submit"
            variant="default"
          >
            {isSaved && <CheckIcon className="size-4" />}
            {isSaved
              ? "Saved"
              : fetcher.state !== "idle"
                ? "Saving…"
                : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </fetcher.Form>
  );
}
