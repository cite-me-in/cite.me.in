import { Link, redirect } from "react-router";
import AuthForm from "~/components/ui/AuthForm";
import { Button } from "~/components/ui/Button";
import { requireUserAccess } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/invite.$token";

export function meta() {
  return [{ title: "Accept Invitation | Cite.me.in" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const invitation = await prisma.siteInvitation.findUnique({
    where: { token: params.token },
    include: { site: { select: { id: true, domain: true } } },
  });

  if (!invitation || invitation.status !== "PENDING")
    return { status: "invalid" as const };

  // Check expiry (7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (invitation.createdAt < sevenDaysAgo) {
    await prisma.siteInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    return { status: "expired" as const };
  }

  try {
    const { user } = await requireUserAccess(request);
    if (user.email.toLowerCase() !== invitation.email.toLowerCase())
      return { status: "wrong-user" as const, invitedEmail: invitation.email };

    // Accept immediately
    await prisma.$transaction([
      prisma.siteUser.upsert({
        where: {
          siteId_userId: { siteId: invitation.siteId, userId: user.id },
        },
        create: { siteId: invitation.siteId, userId: user.id },
        update: {},
      }),
      prisma.siteInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      }),
    ]);
    throw redirect(`/site/${invitation.site.domain}/citations`);
  } catch {
    // Not logged in — check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    return {
      status: "pending" as const,
      email: invitation.email,
      siteDomain: invitation.site.domain,
      hasAccount: !!existingUser,
      token: params.token,
    };
  }
}

export default function InvitePage({ loaderData }: Route.ComponentProps) {
  if (loaderData.status === "invalid")
    return (
      <AuthForm
        title="Invalid invitation"
        form={<p>This invitation link is invalid or has already been used.</p>}
        footer={<Link to="/sign-in">Sign in</Link>}
      />
    );

  if (loaderData.status === "expired")
    return (
      <AuthForm
        title="Invitation expired"
        form={
          <p>
            This invitation has expired. Ask the site owner to send a new one.
          </p>
        }
        footer={<Link to="/sign-in">Sign in</Link>}
      />
    );

  if (loaderData.status === "wrong-user")
    return (
      <AuthForm
        title="Wrong account"
        form={
          <p>
            This invitation was sent to {loaderData.invitedEmail}. Sign in with
            that account to accept it.
          </p>
        }
        footer={<Link to="/sign-in">Sign in</Link>}
      />
    );

  // status === "pending"
  const { email, siteDomain, hasAccount, token } = loaderData;
  const authPath = hasAccount
    ? `/sign-in?invite=${token}`
    : `/sign-up?invite=${token}`;

  return (
    <AuthForm
      title={`Join ${siteDomain}`}
      form={
        <div className="space-y-4">
          <p>
            You've been invited to join <strong>{siteDomain}</strong> on
            Cite.me.in.
          </p>
          <p className="text-gray-600">This invite was sent to {email}.</p>
          <Button render={<Link to={authPath} />} className="w-full">
            {hasAccount ? "Sign in to accept" : "Create account to accept"}
          </Button>
        </div>
      }
    />
  );
}
