import prisma from "~/lib/prisma.server";
import type { User } from "~/prisma";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function requireAdminApiKey(request: Request): Promise<void> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw unauthorized();
  const token = auth.slice(7);
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret || token !== secret) throw unauthorized();
}

export async function requireUserByApiKey(request: Request): Promise<User> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw unauthorized();
  const token = auth.slice(7);
  const user = await prisma.user.findUnique({ where: { apiKey: token } });
  if (!user) throw unauthorized();
  return user;
}
