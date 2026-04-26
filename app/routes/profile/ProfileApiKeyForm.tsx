import { CopyCheckIcon, PointerIcon } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import { FieldError, FieldGroup, FieldSet } from "~/components/ui/FieldSet";
import { Input } from "~/components/ui/Input";
import type { action } from "./route";

export default function ProfileApiKeyForm({
  apiKey,
}: {
  apiKey: string | null;
}) {
  const fetcher = useFetcher<typeof action>();
  const data = fetcher.data;
  const currentKey = (data && "apiKey" in data ? data.apiKey : null) ?? apiKey;
  const [isCopied, setIsCopied] = useState(false);

  return (
    <fetcher.Form method="post" action="/profile">
      <FieldSet>
        <FieldGroup>
          {currentKey && (
            <Input
              onClick={() => {
                void navigator.clipboard.writeText(currentKey);
                setIsCopied(true);
              }}
              readOnly
              value={currentKey}
              className="font-mono text-sm"
            />
          )}
        </FieldGroup>
        {data && "error" in data && data.error && (
          <FieldError className="text-lg">{data.error}</FieldError>
        )}
        <p className="text-foreground/70 flex items-center gap-2 text-sm">
          <PointerIcon className="size-4" />
          Click text field to copy API key to clipboard.
        </p>
        <input type="hidden" name="intent" value="regenerateApiKey" />
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          {isCopied && <CopyCheckIcon className="size-4" />}
          {currentKey ? "Regenerate API key" : "Generate API key"}
        </Button>
      </FieldSet>
    </fetcher.Form>
  );
}
