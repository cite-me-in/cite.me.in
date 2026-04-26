import { MailIcon } from "lucide-react";
import { Form } from "react-router";
import { ActiveLink } from "~/components/ui/ActiveLink";
import AuthForm from "~/components/ui/AuthForm";
import { Button } from "~/components/ui/Button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "~/components/ui/FieldSet";
import { Input } from "~/components/ui/Input";
import sendPasswordRecoveryEmail from "~/emails/PasswordRecovery";
import captureAndLogError from "~/lib/captureAndLogError.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/password-recovery";

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = (form.get("email") as string).trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordRecoveryToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    try {
      await sendPasswordRecoveryEmail({
        email,
        url: new URL(`/reset-password/${token}`, request.url).toString(),
      });
    } catch {
      captureAndLogError(new Error("Failed to send password recovery email"));
    }
  }

  return { sent: true };
}

export default function PasswordRecovery({ actionData }: Route.ComponentProps) {
  if (actionData?.sent) {
    return (
      <AuthForm
        title="Check your email"
        form={
          <p>
            If that email is associated with an account, we've sent a sign-in
            link. It expires in 30 minutes.
          </p>
        }
      />
    );
  }

  return (
    <AuthForm
      title="Reset password"
      form={
        <Form method="post">
          <FieldSet>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  autoFocus
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="Your email"
                />
              </Field>
            </FieldGroup>
            <Button type="submit" className="w-full text-lg">
              <MailIcon className="size-4" />
              Send recovery link
            </Button>
          </FieldSet>
        </Form>
      }
      footer={
        <ActiveLink to="/sign-in" variant="button">
          Back to sign in
        </ActiveLink>
      }
    />
  );
}
