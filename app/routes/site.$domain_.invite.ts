import { redirect } from "react-router";
import { requireUser } from "~/lib/auth.server";
import captureException from "~/lib/captureException.server";
import sendSiteInvitationEmail from "~/lib/emails/SiteInvitation";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/site.$id_.invite";

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const site = await prisma.site.findFirst({
    where: { id: params.id, ownerId: user.id },
  });
  if (!site) throw new Response("Forbidden", { status: 403 });

  const formData = await request.formData();
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  if (!email) return redirect(`/site/${site.id}/settings`);

  // Check if already a member
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await prisma.siteUser.findUnique({
      where: { siteId_userId: { siteId: site.id, userId: existingUser.id } },
    });
    if (alreadyMember || existingUser.id === site.ownerId)
      return redirect(`/site/${site.id}/settings`);
  }

  // Cancel any existing pending invite for this email+site
  await prisma.siteInvitation.updateMany({
    where: { siteId: site.id, email, status: "PENDING" },
    data: { status: "EXPIRED" },
  });

  const token = crypto.randomUUID();
  await prisma.siteInvitation.create({
    data: { siteId: site.id, invitedById: user.id, email, token },
  });

  try {
    await sendSiteInvitationEmail({
      to: email,
      siteDomain: site.domain,
      invitedByEmail: user.email,
      url: new URL(`/invite/${token}`, request.url).toString(),
    });
  } catch (error) {
    captureException(error);
  }

  return redirect(`/site/${site.id}/settings`);
}

export async function loader() {
  throw new Response("Not Found", { status: 404 });
}
