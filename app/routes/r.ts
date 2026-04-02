import generateUnsubscribeToken from "~/emails/generateUnsubscribeToken";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/r";

export async function loader({ request }: Route.LoaderArgs) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const email = searchParams.get("email");
  const token = searchParams.get("token");

  const dest = url?.startsWith("/") ? url : "/";

  if (email && token && token === generateUnsubscribeToken(email)) {
    await prisma.user.updateMany({
      where: { email, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }

  return new Response(null, { status: 302, headers: { Location: dest } });
}
