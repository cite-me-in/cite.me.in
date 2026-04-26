import { redirect } from "react-router";
import sendSiteInvitationEmail from "~/emails/SiteInvitation";
import { requireSiteOwner } from "~/lib/auth.server";
import captureAndLogError from "~/lib/captureAndLogError.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/site.$domain_.invite";

export async function action({ request, params }: Route.ActionArgs) {
  const { site, user } = await requireSiteOwner({
    domain: params.domain,
    request,
  });

  const formData = await request.formData();
  const email = new String(formData.get("email")).trim().toLowerCase();
  if (!email) return redirect(`/site/${site.domain}/settings`);

  // Check if already a member
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await prisma.siteUser.findUnique({
      where: { siteId_userId: { siteId: site.id, userId: existingUser.id } },
    });
    if (alreadyMember || existingUser.id === user.id)
      return redirect(`/site/${site.domain}/settings`);
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
      email,
      siteDomain: site.domain,
      invitedByEmail: user.email,
      url: new URL(`/invite/${token}`, request.url).toString(),
    });
  } catch (error) {
    captureAndLogError(error);
  }

  return redirect(`/site/${site.domain}/settings`);
}

export async function loader() {
  throw new Response("Not Found", { status: 404 });
}
