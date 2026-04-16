import { Section, Text } from "@react-email/components";
import Button from "~/components/email/Button";
import envVars from "~/lib/envVars.server";
import { daysAgo } from "~/lib/formatDate";
import prisma from "~/lib/prisma.server";
import { sendEmail } from "./sendEmails";

export async function sendCitedPageAlertEmail({
  page,
  site,
}: {
  page: { id: string; url: string; citationCount: number; siteId: string };
  site: {
    domain: string;
    owner: { id: string; email: string; unsubscribed: boolean };
  };
}) {
  const dedupKey = "CitedPageAlert";
  const { owner } = site;

  const already = await prisma.sentEmail.findFirst({
    where: { userId: owner.id, type: dedupKey, sentAt: { gt: daysAgo(7) } },
  });
  if (already) return;

  await sendEmail({
    isTransactional: false,
    subject: `Cited page is down: ${page.url}`,
    sendTo: owner,
    email: (
      <Section>
        <Text>
          A page on <strong>{site.domain}</strong> that has been cited{" "}
          {page.citationCount} times is no longer responding:{" "}
          <a
            href={`${envVars.VITE_APP_URL}/r?url=${encodeURIComponent(page.url)}`}
          >
            {page.url}
          </a>
          . AI platforms may stop citing this page until it is restored.
        </Text>

        <Section className="my-8 text-center">
          <Button
            href={new URL(
              `/site/${site.domain}/pages`,
              envVars.VITE_APP_URL,
            ).toString()}
          >
            View citing pages
          </Button>
        </Section>
      </Section>
    ),
  });

  await prisma.sentEmail.create({
    data: { userId: owner.id, type: dedupKey },
  });
}
