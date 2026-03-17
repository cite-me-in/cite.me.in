import { invariant } from "es-toolkit";
import { MailIcon } from "lucide-react";
import { Form, redirect } from "react-router";
import AuthForm from "~/components/ui/AuthForm";
import { Button } from "~/components/ui/Button";
import { FieldSet } from "~/components/ui/FieldSet";
import sendEmailVerificationEmail from "~/emails/EmailVerification";
import { createEmailVerificationToken } from "~/lib/auth.server";
import logError from "~/lib/logError.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";

export async function loader({ params }: Route.LoaderArgs) {
  const { token } = params;
  const now = new Date();

  const result = await prisma.emailVerificationToken.updateMany({
    where: { token, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });

  if (result.count === 0) return { invalid: true };

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    select: { userId: true },
  });

  invariant(record, "token not found after atomic update");

  await prisma.user.update({
    where: { id: record.userId },
    data: { emailVerifiedAt: now },
  });

  return redirect("/");
}

export async function action({ params, request }: Route.ActionArgs) {
  const { token } = params;

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          unsubscribed: true,
        },
      },
    },
  });

  if (record?.user && !record.user.emailVerifiedAt) {
    const newToken = await createEmailVerificationToken(record.user.id);
    try {
      await sendEmailVerificationEmail({
        email: record.user.email,
        url: new URL(`/verify-email/${newToken}`, request.url).toString(),
      });
    } catch (error) {
      logError(error);
    }
  }

  return { resent: true };
}

export default function VerifyEmail({ actionData }: Route.ComponentProps) {
  if (actionData?.resent)
    return (
      <AuthForm
        title="Check your email"
        form={
          <p>
            We've sent a new verification link to your email address. It expires
            in 24 hours.
          </p>
        }
      />
    );

  return (
    <AuthForm
      title="Link expired"
      form={
        <Form method="post">
          <FieldSet>
            <p>This verification link is invalid or has already been used.</p>
            <Button type="submit" className="w-full text-lg">
              <MailIcon className="size-4" />
              Send new verification email
            </Button>
          </FieldSet>
        </Form>
      }
    />
  );
}
