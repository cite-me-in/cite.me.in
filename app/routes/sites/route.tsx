import { captureException } from "@sentry/react-router";
import { invariant } from "node_modules/es-toolkit/dist/util/invariant.mjs";
import { useState } from "react";
import { redirect, useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Field, FieldError, FieldLabel } from "~/components/ui/FieldSet";
import { Input } from "~/components/ui/Input";
import Spinner from "~/components/ui/Spinner";
import { requireUser } from "~/lib/auth.server";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
import {
  addSiteToAccount,
  deleteSite,
  loadSitesWithMetrics,
} from "~/lib/sites.server";
import type { Route } from "./+types/route";
import SiteEntry from "./SiteEntry";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Your Sites | CiteUp" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const sites = await loadSitesWithMetrics(user.accountId);
  return { sites };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  switch (request.method) {
    case "POST": {
      const url = formData.get("url")?.toString() ?? "";
      try {
        const site = await addSiteToAccount(user.account, url);
        await generateSiteQueries(site);
        return redirect(`/site/${site.id}/suggestions`);
      } catch (error) {
        captureException(error, { extra: { url } });
        return {
          error:
            error instanceof Error
              ? error.message
              : "An unknown error occurred while adding the site",
        };
      }
    }

    case "DELETE": {
      const siteId = formData.get("siteId")?.toString();
      invariant(siteId, "Site ID is required");
      await deleteSite({ accountId: user.accountId, siteId });
      return { ok: true };
    }
  }
}

export default function SitesPage({ loaderData }: Route.ComponentProps) {
  const { sites } = loaderData;
  const [isAddSiteFormOpen, setIsAddSiteFormOpen] = useState(
    sites.length === 0,
  );
  const fetcher = useFetcher<typeof action>();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-12">
      <div className="flex flex-row items-center justify-between gap-4">
        <h1 className="font-heading text-3xl">Your Sites</h1>
        {!isAddSiteFormOpen && (
          <Button onClick={() => setIsAddSiteFormOpen(true)}>Add Site</Button>
        )}
      </div>

      {isAddSiteFormOpen && <AddSiteForm fetcher={fetcher} />}

      {sites.length > 0 && (
        <Card className="w-full max-w-2xl">
          <CardContent className="space-y-4 divide-y-2 divide-black/10">
            {sites.map((item) => (
              <SiteEntry
                avgScore={item.avgScore}
                fetcher={fetcher}
                key={item.site.id}
                site={item.site}
                totalBotVisits={item.totalBotVisits}
                totalCitations={item.totalCitations}
                uniqueBots={item.uniqueBots}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function AddSiteForm({
  fetcher,
}: {
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
}) {
  const isProcessing = fetcher.state !== "idle";
  const result = fetcher.data;
  const error = result && "error" in result ? result.error : undefined;

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
              Be patient, nothing will happen for a few minutes. We're going to
              check all these queries against the domain, asking Claude, OpenAI,
              Google, and Perplexity to see if they return any citations. Keep
              this page open to see the progress.
            </p>
            <p className="text-base text-foreground/60">
              The domain we're adding is{" "}
              <code>some url{fetcher.formData?.get("url")?.toString()}</code>
            </p>
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
