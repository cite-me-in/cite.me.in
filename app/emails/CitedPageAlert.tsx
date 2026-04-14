import { Text } from "@react-email/components";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import { sendEmail } from "./sendEmails";

const DEDUP_KEY = (pageId: string) => `cited-page-alert:${pageId}`;
const DEDUP_DAYS = 7;

export async function sendCitedPageAlertEmail({
  page,
  siteOwnerId,
}: {
  page: { id: string; url: string; citationCount: number; siteId: string };
  siteOwnerId: string;
}) {
  const dedupKey = DEDUP_KEY(page.id);
  const threshold = new Date(Date.now() - DEDUP_DAYS * 24 * 60 * 60 * 1000);

  const already = await prisma.sentEmail.findFirst({
    where: { userId: siteOwnerId, type: dedupKey, sentAt: { gt: threshold } },
  });
  if (already) return;

  const user = await prisma.user.findUnique({
    where: { id: siteOwnerId },
    select: { email: true, unsubscribed: true },
  });
  if (!user) return;

  const site = await prisma.site.findUnique({
    where: { id: page.siteId },
    select: { domain: true },
  });
  if (!site) return;

  await sendEmail({
    isTransactional: true,
    subject: `Cited page is down: ${page.url}`,
    sendTo: user,
    email: (
      <Text>
        A page on <strong>{site.domain}</strong> that has been cited{" "}
        {page.citationCount} times is no longer responding:{" "}
        <a href={`${envVars.VITE_APP_URL}/r?url=${encodeURIComponent(page.url)}`}>{page.url}</a>. AI platforms may stop citing this
        page until it is restored.
      </Text>
    ),
  });

  await prisma.sentEmail.create({ data: { userId: siteOwnerId, type: dedupKey } });
}
