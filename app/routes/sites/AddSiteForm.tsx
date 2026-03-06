import type { useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Field, FieldError, FieldLabel } from "~/components/ui/FieldSet";
import { Input } from "~/components/ui/Input";
import Spinner from "~/components/ui/Spinner";
import type { action } from "./route";

export default function AddSiteForm({
  fetcher,
}: {
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
}) {
  const isProcessing = fetcher.state !== "idle";
  const result = fetcher.data;
  const error = result && "error" in result ? result.error : undefined;
  const url = fetcher.formData?.get("url")?.toString();

  return (
    <Card className="w-full max-w-2xl" variant="yellow" fadeIn={true}>
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
            <p className="text-base text-foreground/60">
              Be patient, nothing will happen for a few seconds. We're going to
              check the domain and generate queries to ask Claude, OpenAI,
              Google, and Perplexity to see if they return any citations.
            </p>
            {url && (
              <p className="text-base text-foreground/60">
                The domain we're adding is <code>{url}</code>
              </p>
            )}
          </div>
        ) : (
          <fetcher.Form method="post" noValidate className="space-y-4">
            <p className="text-base text-foreground/60">
              Enter a full URL (https://yoursite.com) or just the domain name
              (yoursite.com).
            </p>
            <Field>
              <FieldLabel htmlFor="url">Website URL or domain</FieldLabel>
              <Input
                aria-label="Website URL or domain"
                autoFocus
                id="url"
                name="url"
                placeholder="https://yoursite.com"
                type="text"
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
            <Button type="submit">Add Site</Button>
          </fetcher.Form>
        )}
      </CardContent>
    </Card>
  );
}
