import { render } from "@react-email/components";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import { WeeklyDigestEmail, sendSiteDigestEmails } from "~/emails/WeeklyDigest";
import { requireUserAccess } from "~/lib/auth.server";
import { loadWeeklyDigestMetrics } from "~/lib/weeklyDigest.server";
import type { Route } from "./+types/[_]preview";

const siteId = "cmmi2yfwi000404l9qcci3j0x";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserAccess(request);
  const data = await loadWeeklyDigestMetrics(siteId);
  const html = await render(
    <WeeklyDigestEmail {...data} unsubscribeURL={"/"} />,
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
        className="w-full border-0"
        style={{ height: "80vh" }}
        title="Email preview"
      />
    </div>
  );
}
