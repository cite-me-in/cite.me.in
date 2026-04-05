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
import { loadWeeklyDigestMetrics } from "~/lib/weeklyDigest.server";
import type { Route } from "./+types/[_]preview";

const siteId = "cmmi2yfwi000404l9qcci3j0x";

export const handle = { siteNav: true };

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUserAccess(request);
  if (!user.isAdmin) throw new Response("Forbidden", { status: 403 });

  const data = await loadWeeklyDigestMetrics(siteId);
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

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUserAccess(request);
  if (!user.isAdmin) throw new Response("Forbidden", { status: 403 });

  const data = await loadWeeklyDigestMetrics(siteId);
  return await sendSiteDigestEmails({
    ...data,
    sendTo: [{ email: user.email, unsubscribed: false }],
  });
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
