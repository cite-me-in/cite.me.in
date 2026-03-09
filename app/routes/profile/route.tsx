import { useLoaderData } from "react-router";
import * as zod from "zod";
import AuthForm from "~/components/ui/AuthForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/Tabs";
import { hashPassword, requireUser, verifyPassword } from "~/lib/auth.server";
import captureException from "~/lib/captureException.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";
import ProfileEmailForm from "./ProfileEmailForm";
import ProfilePasswordForm from "./ProfilePasswordForm";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Profile Settings | CiteUp" },
    { name: "description", content: "Manage your account email and password." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  const email = form.get("email")?.toString().trim().toLowerCase();
  if (email) return updateEmail({ userId: user.id, email });

  const currentPassword = form.get("currentPassword")?.toString();
  const newPassword = form.get("newPassword")?.toString();
  const confirmPassword = form.get("confirmPassword")?.toString();
  if (currentPassword && newPassword && confirmPassword)
    return updatePassword({
      user,
      currentPassword,
      newPassword,
      confirmPassword,
    });

  return { error: "Nothing to update" };
}

async function updateEmail({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  try {
    const { error } = zod.email().safeParse(email);
    if (error) return { error: "Enter a valid email address" };

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
  if (newPassword.length < 6)
    return { error: "New password must be at least 6 characters" };
  if (newPassword !== confirmPassword)
    return { error: "Passwords do not match" };
  if (!(await verifyPassword(currentPassword, user.passwordHash)))
    return { error: "Current password is incorrect" };

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    return { success: "Password changed successfully" };
  } catch (error) {
    captureException(error);
    return { error: "Failed to change password, please try again" };
  }
}

export default function ProfilePage() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <AuthForm
      title="Update your profile"
      form={
        <Tabs defaultValue="email" className="space-y-8">
          <div className="flex justify-center">
            <TabsList>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="password">Password</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="email">
            <ProfileEmailForm user={user} />
          </TabsContent>

          <TabsContent value="password">
            <ProfilePasswordForm />
          </TabsContent>
        </Tabs>
      }
    />
  );
}
