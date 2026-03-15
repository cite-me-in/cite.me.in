import { redirect } from "react-router";
import sendSiteInvitationEmail from "~/emails/SiteInvitation";
import { requireUser } from "~/lib/auth.server";
import logError from "~/lib/logError.server";
import prisma from "~/lib/prisma.server";
import { requireSiteOwner } from "~/lib/sites.server";
import type { Route } from "./+types/site.$domain_.invite";

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const site = await requireSiteOwner(params.domain, user.id);

  const formData = await request.formData();
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  if (!email) return redirect(`/site/${site.domain}/settings`);

  // Check if already a member
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await prisma.siteUser.findUnique({
      where: { siteId_userId: { siteId: site.id, userId: existingUser.id } },
    });
    if (alreadyMember || existingUser.id === site.ownerId)
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
      to: email,
      siteDomain: site.domain,
      invitedByEmail: user.email,
      url: new URL(`/invite/${token}`, request.url).toString(),
    });
  } catch (error) {
    logError(error);
  }

  return redirect(`/site/${site.domain}/settings`);
}

export async function loader() {
  throw new Response("Not Found", { status: 404 });
}
