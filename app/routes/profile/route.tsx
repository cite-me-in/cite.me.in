import { Form, redirect, useLoaderData } from "react-router";
import * as zod from "zod";
import AuthForm from "~/components/ui/AuthForm";
import { Button } from "~/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/Tabs";
import { hashPassword, requireUserAccess, verifyPassword } from "~/lib/auth.server";
import captureAndLogError from "~/lib/captureAndLogError.server";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import getStripe from "~/lib/stripe.server";
import type { Route } from "./+types/route";
import ProfileApiKeyForm from "./ProfileApiKeyForm";
import ProfileEmailForm from "./ProfileEmailForm";
import ProfilePasswordForm from "./ProfilePasswordForm";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Profile Settings | Cite.me.in" },
    { name: "description", content: "Manage your account email and password." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, account } = await requireUserAccess(request);
  return { user, account };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUserAccess(request);
  const form = await request.formData();

  const intent = form.get("intent") as string;

  if (intent === "billingPortal") {
    const account = await prisma.account.findUnique({
      where: { userId: user.id },
      select: { stripeCustomerId: true },
    });
    if (!account) return { error: "No active subscription found" };

    const session = await getStripe().billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${envVars.VITE_APP_URL}/profile`,
    });
    return redirect(session.url);
  }

  if (intent === "regenerateApiKey") return regenerateApiKey({ userId: user.id });

  const email = ((form.get("email") as string | null) ?? "").trim().toLowerCase();
  if (email) return updateEmail({ userId: user.id, email });

  const currentPassword = form.get("currentPassword") as string;
  const newPassword = form.get("newPassword") as string;
  const confirmPassword = form.get("confirmPassword") as string;
  if (currentPassword && newPassword && confirmPassword)
    return updatePassword({
      user,
      currentPassword,
      newPassword,
      confirmPassword,
    });

  return { error: "Nothing to update" };
}

async function updateEmail({ userId, email }: { userId: string; email: string }) {
  try {
    const { error } = zod.email().safeParse(email);
    if (error) return { error: "Enter a valid email address" };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId)
      return { error: "That email address is already in use" };

    await prisma.user.update({ where: { id: userId }, data: { email } });
    return { success: "Email updated successfully" };
  } catch {
    return { error: "That email address is already in use" };
  }
}

async function updatePassword({
  user,
  currentPassword,
  newPassword,
  confirmPassword,
}: {
  user: { id: string; passwordHash: string };
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  if (newPassword.length < 6) return { error: "New password must be at least 6 characters" };
  if (newPassword !== confirmPassword) return { error: "Passwords do not match" };
  if (!(await verifyPassword(currentPassword, user.passwordHash)))
    return { error: "Current password is incorrect" };

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    return { success: "Password changed successfully" };
  } catch (error) {
    captureAndLogError(error);
    return { error: "Failed to change password, please try again" };
  }
}

async function regenerateApiKey({ userId }: { userId: string }) {
  try {
    const { generateApiKey } = await import("random-password-toolkit");
    const apiKey = `cite.me.in_${userId}_${generateApiKey(24)}`;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { apiKey },
      select: { apiKey: true },
    });
    return { apiKey: updated.apiKey };
  } catch (error) {
    captureAndLogError(error);
    return { error: "Failed to generate API key" };
  }
}

export default function ProfilePage() {
  const { user, account } = useLoaderData<typeof loader>();

  return (
    <AuthForm
      title="Update your profile"
      form={
        <div className="space-y-8">
          <Tabs defaultValue="email" className="space-y-8">
            <div className="flex justify-center">
              <TabsList>
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="apiKey">API Key</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="email">
              <ProfileEmailForm user={user} />
            </TabsContent>

            <TabsContent value="password">
              <ProfilePasswordForm />
            </TabsContent>

            <TabsContent value="apiKey">
              <ProfileApiKeyForm apiKey={user.apiKey ?? null} />
            </TabsContent>
          </Tabs>

          {user.plan === "paid" && (
            <section>
              <h2 className="font-heading mb-4 text-xl">Subscription</h2>
              <p className="text-foreground/70 mb-4 text-sm">
                You're on Pro ({account?.interval === "annual" ? "annual" : "monthly"} billing).
              </p>
              <Form method="post">
                <input type="hidden" name="intent" value="billingPortal" />
                <Button type="submit" variant="outline">
                  Manage Subscription
                </Button>
              </Form>
            </section>
          )}
        </div>
      }
    />
  );
}
