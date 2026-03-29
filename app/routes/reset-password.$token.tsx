import { invariant } from "es-toolkit";
import { Link, redirect } from "react-router";
import AuthForm from "~/components/ui/AuthForm";
import { createSession } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/reset-password.$token";

export async function loader({ params, request }: Route.LoaderArgs) {
  const token = params.token;

  const result = await prisma.passwordRecoveryToken.updateMany({
    where: { token, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  if (result.count === 0) return { invalid: true };

  const record = await prisma.passwordRecoveryToken.findUnique({
    where: { token },
    select: { userId: true },
  });

  invariant(record, "token not found after atomic update");
  const setCookie = await createSession(record.userId, request);

  return redirect("/sites", { headers: { "Set-Cookie": setCookie } });
}

export default function ResetPassword() {
  return (
    <AuthForm
      title="Link expired"
      form={
        <p>
          This link is invalid or has already been used. Request a new one from
          the{" "}
          <Link to="/password-recovery" className="text-blue-500 underline">
            password recovery page
          </Link>
          .
        </p>
      }
    />
  );
}
