import { captureException } from "@sentry/react-router";
import { useEffect } from "react";
import { redirect, useFetcher, useNavigate } from "react-router";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Field, FieldError, FieldLabel } from "~/components/ui/FieldSet";
import { Input } from "~/components/ui/Input";
import { requireUser } from "~/lib/auth.server";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
import prisma from "~/lib/prisma.server";
import {
  extractDomain,
  fetchPageContent,
  verifyDomain,
} from "~/lib/sites.server";
import type { Route } from "./+types/route";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return {};
}

export function meta(): Route.MetaDescriptors {
  return [{ title: "Add a Site | CiteUp" }];
}

type Suggestion = { group: string; query: string };

type ActionResult =
  | { error: string }
  | { siteId: string }
  | { siteId: string; suggestions: Suggestion[] };

export async function action({
  request,
}: Route.ActionArgs): Promise<ActionResult | Response> {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = form.get("_intent")?.toString();

  // Phase 2: save approved queries then redirect
  if (intent === "save-queries") {
    const siteId = form.get("siteId")?.toString() ?? "";
    const site = await prisma.site.findFirst({
      where: { id: siteId, accountId: user.accountId },
    });
    if (!site) return { error: "Site not found" };

    const raw = form.get("queries")?.toString() ?? "[]";
    let queries: Suggestion[] = [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) queries = parsed as Suggestion[];
    } catch {
      // ignore
    }
    const valid = queries.filter((q) => q.group && q.query.trim());
    if (valid.length > 0) {
      await prisma.siteQuery.createMany({
        data: valid.map((q) => ({
          siteId: site.id,
          group: q.group,
          query: q.query.trim(),
        })),
      });
    }
    return redirect(`/site/${site.id}`);
  }

  // Phase 1: validate + create site + generate suggestions
  const url = form.get("url")?.toString().trim() ?? "";
  const domain = extractDomain(url);
  if (!domain) return { error: "Enter a valid website URL or domain name" };

  const existing = await prisma.site.findFirst({
    where: { accountId: user.accountId, domain },
  });
  if (existing) return { error: "That domain is already added to your account" };

  const dnsOk = await verifyDomain(domain);
  if (!dnsOk)
    return { error: `No DNS records found for ${domain}. Is the domain live?` };

  const content = await fetchPageContent(domain);
  const site = await prisma.site.create({
    data: { domain, account: { connect: { id: user.accountId } }, content },
  });

  if (!content) return { siteId: site.id };

  try {
    const suggestions = await generateSiteQueries(content);
    return { siteId: site.id, suggestions };
  } catch (error) {
    captureException(error, { extra: { siteId: site.id } });
    return { siteId: site.id };
  }
}

export default function AddSitePage() {
  const navigate = useNavigate();
  const fetcher = useFetcher<ActionResult>();
  const isProcessing = fetcher.state !== "idle";
  const result = fetcher.data;
  const error = result && "error" in result ? result.error : undefined;

  useEffect(() => {
    if (result && "siteId" in result) {
      navigate(`/site/${result.siteId}`);
    }
  }, [result, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Add a Site</CardTitle>
        </CardHeader>
        <CardContent>
          {isProcessing ? (
            <div className="flex items-center gap-3 py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
              <p className="text-foreground/70">
                Verifying domain and fetching content…
              </p>
            </div>
          ) : (
            <fetcher.Form method="post" noValidate className="space-y-4">
              <p className="text-foreground/60 text-sm">
                Enter a full URL (https://yoursite.com) or just the domain name
                (yoursite.com).
              </p>
              <Field>
                <FieldLabel htmlFor="url">Website URL or domain</FieldLabel>
                <Input
                  id="url"
                  name="url"
                  type="text"
                  placeholder="https://yoursite.com"
                  autoFocus
                />
                {error && <FieldError>{error}</FieldError>}
              </Field>
              <Button type="submit">Add Site</Button>
            </fetcher.Form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
