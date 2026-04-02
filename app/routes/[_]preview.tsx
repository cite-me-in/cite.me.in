import { render } from "@react-email/components";
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
  const data = await loadWeeklyDigestMetrics(siteId);
  const token = generateUnsubscribeToken(user.email);
  const html = await render(
    <EmailLinkContext.Provider value={{ email: user.email, token }}>
      <EmailLayout subject={data.subject}>
        <WeeklyDigestEmail {...data} />
      </EmailLayout>
    </EmailLinkContext.Provider>,
  );
  return { html };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUserAccess(request);
  const data = await loadWeeklyDigestMetrics(siteId);
  return await sendSiteDigestEmails({ ...data, toEmails: [user.email] });
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
          {fetcher.state === "submitting" ? "Sending..." : "Send Email"}
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
