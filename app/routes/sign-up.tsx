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
import { createSession, hashPassword } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/sign-up";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return {
    inviteToken: url.searchParams.get("invite") ?? "",
    next: url.searchParams.get("next") ?? "",
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = (form.get("email") ?? "").toString().trim();
  const password = (form.get("password") ?? "").toString();
  const confirm = (form.get("confirm") ?? "").toString();
  const inviteToken = (form.get("inviteToken") ?? "").toString().trim();
  const next = (form.get("next") ?? "").toString().trim();

  const errors: Record<string, string> = {};

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Enter a valid email address";

  if (password.length < 6)
    errors.password = "Password must be at least 6 characters";

  if (password !== confirm) errors.confirm = "Passwords do not match";

  if (Object.keys(errors).length > 0) return { errors };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return { errors: { email: "An account with this email already exists" } };

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { email, passwordHash },
  });

  const setCookie = await createSession(user.id, request);

  const redirectTo = inviteToken
    ? `/invite/${inviteToken}`
    : next.startsWith("/")
      ? next
      : "/sites";
  return redirect(redirectTo, { headers: { "Set-Cookie": setCookie } });
}

export default function SignUp({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  const errors = actionData?.errors ?? {};

  return (
    <AuthForm
      title="Create account"
      form={
        <Form method="post">
          {loaderData.inviteToken && (
            <input
              type="hidden"
              name="inviteToken"
              value={loaderData.inviteToken}
            />
          )}
          {loaderData.next && (
            <input type="hidden" name="next" value={loaderData.next} />
          )}
          <FieldSet>
            <FieldGroup>
              <Field data-invalid={!!errors.email}>
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
                {errors.email && <FieldError>{errors.email}</FieldError>}
              </Field>
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Your password"
                />
                {errors.password && <FieldError>{errors.password}</FieldError>}
              </Field>
              <Field data-invalid={!!errors.confirm}>
                <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Confirm your password"
                />
                {errors.confirm && <FieldError>{errors.confirm}</FieldError>}
              </Field>
            </FieldGroup>
            <Button type="submit" className="w-full text-lg">
              Create account
            </Button>
          </FieldSet>
        </Form>
      }
      footer={
        <ActiveLink to="/sign-in" variant="button">
          Already have an account? Sign in
        </ActiveLink>
      }
    />
  );
}
