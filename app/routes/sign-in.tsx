import { Form, redirect } from "react-router";
import { ActiveLink } from "~/components/ui/ActiveLink";
import AuthForm from "~/components/ui/AuthForm";
import { Button } from "~/components/ui/Button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "~/components/ui/FieldSet";
import { Input } from "~/components/ui/Input";
import { createSession, verifyPassword } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/sign-in";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return { inviteToken: url.searchParams.get("invite") ?? "" };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = (form.get("email") as string).trim().toLowerCase();
  const password = form.get("password") as string;
  const inviteToken = ((form.get("inviteToken") as string | null) ?? "").trim();

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash)))
    return { error: "email and password do not match an existing account" };

  const setCookie = await createSession(user.id, request);

  const redirectTo = inviteToken ? `/invite/${inviteToken}` : "/sites";
  return redirect(redirectTo, { headers: { "Set-Cookie": setCookie } });
}

export default function SignIn({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  return (
    <AuthForm
      title="Sign in"
      form={
        <Form method="post">
          {loaderData.inviteToken && (
            <input
              type="hidden"
              name="inviteToken"
              value={loaderData.inviteToken}
            />
          )}
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
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Your password"
                />
              </Field>
            </FieldGroup>
            {actionData?.error && <FieldError>{actionData.error}</FieldError>}
            <Button type="submit" className="w-full text-lg">
              Sign in
            </Button>
          </FieldSet>
        </Form>
      }
      footer={
        <>
          <ActiveLink to="/password-recovery">Forgot your password?</ActiveLink>
          <ActiveLink to="/sign-up" variant="button">
            Don't have an account? Sign up
          </ActiveLink>
        </>
      }
    />
  );
}
