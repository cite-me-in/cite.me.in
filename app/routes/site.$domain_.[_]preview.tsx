import { Temporal } from "@js-temporal/polyfill";
import { MailIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { render } from "react-email";
import { useFetcher, useSearchParams } from "react-router";
import { Button } from "~/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/Select";
import sendAiLegibilityReport, {
  AiLegibilityReportEmail,
} from "~/emails/AiLegibilityReport";
import EmailLayout from "~/emails/EmailLayout";
import sendSiteSetupEmail, {
  SiteSetupCompleteEmail,
} from "~/emails/SiteSetupComplete";
import { WeeklyDigestEmail, sendSiteDigestEmails } from "~/emails/WeeklyDigest";
import type { ScanResult } from "~/lib/aiLegibility/types";
import { requireUserAccess } from "~/lib/auth.server";
import { formatDateShort } from "~/lib/formatDate";
import prisma from "~/lib/prisma.server";
import loadSetupMetrics from "~/lib/setupMetrics.server";
import { loadWeeklyDigestMetrics } from "~/lib/weeklyDigest.server";
import type { Route } from "./+types/site.$domain_.[_]preview";

const EMAIL_TYPES = [
  "weekly-digest",
  "setup-complete",
  "legibility-report",
] as const;

type EmailType = (typeof EMAIL_TYPES)[number];

const EMAIL_LABELS: Record<EmailType, string> = {
  "weekly-digest": "Weekly Digest",
  "setup-complete": "Setup Complete",
  "legibility-report": "AI Legibility Report",
};

export const handle = { siteNav: true };

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site, user } = await findAdminAndSite(request, params.domain);
  const url = new URL(request.url);
  const type = (url.searchParams.get("type") as EmailType) || "weekly-digest";

  const today = Temporal.Now.plainDateISO("UTC");

  switch (type) {
    case "weekly-digest": {
      const data = await loadWeeklyDigestMetrics(site.id);
      const subject = `${data.site.domain} • ${formatDateShort(today.subtract({ days: 7 }))} — ${formatDateShort(today)}`;
      const html = await render(
        <EmailLayout domain={data.site.domain} subject={subject} user={user}>
          <WeeklyDigestEmail {...data} />
        </EmailLayout>,
      );
      return { html, user };
    }

    case "setup-complete": {
      const metrics = await loadSetupMetrics(site.id);
      const subject = `Setup complete for ${site.domain}`;
      const withCitations = await prisma.site.findUniqueOrThrow({
        where: { id: site.id },
        include: { citations: true },
      });
      const html = await render(
        <EmailLayout domain={site.domain} subject={subject} user={user}>
          <SiteSetupCompleteEmail
            site={withCitations}
            citationsURL={`https://cite.me.in/site/${site.domain}/citations`}
            metrics={metrics}
          />
        </EmailLayout>,
      );
      return { html, user };
    }

    case "legibility-report": {
      const legibility = await prisma.aiLegibilityReport.findFirstOrThrow({
        where: { siteId: site.id, userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { site: { select: { domain: true, citations: true } } },
      });

      const subject = `AI Legibility Report for ${site.domain}`;
      const html = await render(
        <EmailLayout domain={site.domain} subject={subject} user={user}>
          <AiLegibilityReportEmail
            site={legibility.site}
            result={legibility.result as ScanResult}
            reportUrl={`https://cite.me.in/site/${site.domain}/ai-legibility`}
          />
        </EmailLayout>,
      );
      return { html, user };
    }

    default:
      throw new Response("Bad request", { status: 400 });
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { site, user } = await findAdminAndSite(request, params.domain);
  const formData = await request.formData();
  const type = (formData.get("type") as EmailType) || "weekly-digest";

  switch (type) {
    case "weekly-digest": {
      const data = await loadWeeklyDigestMetrics(site.id);
      return await sendSiteDigestEmails({
        ...data,
        sendTo: [{ email: user.email, id: user.id, unsubscribed: false }],
      });
    }

    case "setup-complete": {
      const metrics = await loadSetupMetrics(site.id);
      const withCitations = await prisma.site.findUniqueOrThrow({
        where: { id: site.id },
        include: { citations: true },
      });
      return await sendSiteSetupEmail({
        site: withCitations,
        metrics,
        sendTo: { email: user.email, id: user.id, unsubscribed: false },
      });
    }

    case "legibility-report": {
      const legibility = await prisma.aiLegibilityReport.findFirstOrThrow({
        where: { siteId: site.id, userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { site: { select: { domain: true, citations: true } } },
      });
      return await sendAiLegibilityReport({
        site: legibility.site,
        result: legibility.result as ScanResult,
        sendTo: { email: user.email, id: user.id, unsubscribed: false },
      });
    }

    default:
      throw new Response("Bad request", { status: 400 });
  }
}

async function findAdminAndSite(request: Request, domain: string) {
  const { user } = await requireUserAccess(request);
  if (!user.isAdmin) throw new Response("Forbidden", { status: 403 });

  const site = await prisma.site.findFirst({ where: { domain } });
  if (!site) throw new Response("Not found", { status: 404 });
  return { site, user };
}

export default function EmailPreview({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const currentType = searchParams.get("type") || "weekly-digest";

  useEffect(() => {
    setTimeout(() => {
      const iframe = iframeRef.current;
      if (iframe?.contentDocument) {
        const doc = iframe.contentDocument;
        const body = doc.body;
        if (body) iframe.style.height = `${body.scrollHeight + 20}px`;
      }
    }, 100);
  }, [loaderData.html]);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-end gap-4">
        <Select
          value={currentType}
          onValueChange={(value) => setSearchParams({ type: value as string })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue>{EMAIL_LABELS[currentType as EmailType]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {EMAIL_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {EMAIL_LABELS[t]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <fetcher.Form method="post">
          <input type="hidden" name="type" value={currentType} />
          <Button type="submit" disabled={fetcher.state !== "idle"}>
            <MailIcon className="size-4" />
            {fetcher.state === "submitting"
              ? "Sending..."
              : `Email ${loaderData.user.email}`}
          </Button>
        </fetcher.Form>
      </div>

      <iframe
        srcDoc={loaderData.html}
        ref={iframeRef}
        className="w-full border-0"
        title="Email preview"
      />
    </div>
  );
}
