import { render } from "@react-email/components";
import { MailIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { EmailLinkContext } from "~/components/email/context";
import { Button } from "~/components/ui/Button";
import EmailLayout from "~/emails/EmailLayout";
import generateUnsubscribeToken from "~/emails/generateUnsubscribeToken";
import { WeeklyDigestEmail, sendSiteDigestEmails } from "~/emails/WeeklyDigest";
import { requireUserAccess } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import { loadWeeklyDigestMetrics } from "~/lib/weeklyDigest.server";
import type { Route } from "./+types/site.$domain_.[_]preview";

export const handle = { siteNav: true };

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site, user } = await findAdminAndSite(request, params.domain);
  const data = await loadWeeklyDigestMetrics(site.id);
  const token = generateUnsubscribeToken(user.email);
  const html = await render(
    <EmailLinkContext.Provider value={{ email: user.email, token }}>
      <EmailLayout subject={data.subject}>
        <WeeklyDigestEmail {...data} />
      </EmailLayout>
    </EmailLinkContext.Provider>,
  );
  return { html, user };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { site, user } = await findAdminAndSite(request, params.domain);
  const data = await loadWeeklyDigestMetrics(site.id);
  return await sendSiteDigestEmails({
    ...data,
    sendTo: [{ email: user.email, id: user.id, unsubscribed: false }],
  });
}

async function findAdminAndSite(request: Request, domain: string) {
  const { user } = await requireUserAccess(request);
  if (!user.isAdmin) throw new Response("Forbidden", { status: 403 });

  const site = await prisma.site.findFirst({ where: { domain } });
  if (!site) throw new Response("Not found", { status: 404 });
  return { site, user };
}

export default function WeeklyDigest({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setTimeout(() => {
      const iframe = iframeRef.current;
      if (iframe?.contentDocument) {
        const doc = iframe.contentDocument;
        const body = doc.body;
        if (body) iframe.style.height = `${body.scrollHeight + 20}px`;
      }
    }, 100);
  }, []);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-end gap-4">
        <Button
          type="button"
          onClick={() =>
            fetcher.submit(null, { method: "post", preventScrollReset: true })
          }
          disabled={fetcher.state !== "idle"}
        >
          <MailIcon className="size-4" />
          {fetcher.state === "submitting"
            ? "Sending..."
            : `Email ${loaderData.user.email}`}
        </Button>
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
