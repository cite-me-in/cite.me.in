import { ArrowRightIcon } from "lucide-react";
import type { useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Field, FieldError, FieldLabel } from "~/components/ui/FieldSet";
import { Input } from "~/components/ui/Input";
import Spinner from "~/components/ui/Spinner";
import type { action } from "./route";

export default function AddSiteForm({
  actionData,
  fetcher,
}: {
  actionData: Awaited<ReturnType<typeof action>> | undefined;
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
}) {
  const isProcessing = fetcher.state !== "idle";
  const result = fetcher.data ?? actionData;
  const error = result && "error" in result ? result.error : undefined;
  const url = (fetcher.formData?.get("url") as string)?.trim();

  return (
    <Card variant="yellow" fadeIn={true}>
      <CardHeader>
        <CardTitle>Add a Site</CardTitle>
      </CardHeader>
      <CardContent>
        {isProcessing ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Spinner />
              Verifying domain and generating queries…
            </div>
            <p className="text-foreground/60 text-base">
              Be patient, nothing will happen for a few seconds. We're going to
              check the domain and generate queries to ask Claude, OpenAI, and
              Google to see if they return any citations.
            </p>
            {url && (
              <p className="text-foreground/60 text-base">
                The domain we're adding is <code>{url}</code>
              </p>
            )}
          </div>
        ) : (
          <fetcher.Form method="post" noValidate className="space-y-4">
            <p className="text-foreground/60 text-base">
              Enter a full URL (https://yoursite.com) or just the domain name
              (yoursite.com).
            </p>
            <Field>
              <FieldLabel htmlFor="url">Website URL or domain</FieldLabel>
              <div className="flex justify-between gap-4">
                <Input
                  aria-label="Website URL or domain"
                  // oxlint-disable-next-line jsx_a11y/no-autofocus
                  autoFocus
                  id="url"
                  name="url"
                  placeholder="https://yoursite.com"
                  type="text"
                />
                <Button type="submit">
                  Add Site
                  <ArrowRightIcon className="size-4" />
                </Button>
              </div>
              {error && <FieldError>{error}</FieldError>}
            </Field>
          </fetcher.Form>
        )}
      </CardContent>
    </Card>
  );
}
