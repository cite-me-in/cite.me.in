import prisma from "~/lib/prisma.server";

function parseTokenUserId(token: string): string | null {
  if (!token.startsWith("cite.me.in_")) return null;
  const rest = token.slice("cite.me.in_".length);
  const lastUnderscore = rest.lastIndexOf("_");
  if (lastUnderscore === -1) return null;
  return rest.slice(0, lastUnderscore);
}

export async function requireAdmin(request: Request): Promise<{
  id: string;
  email: string;
  createdAt: Date;
}> {
  const user = await verifyUserAccess(request);
  if (!user.isAdmin) throw new Response("Forbidden", { status: 403 });
  const { isAdmin: _, ...rest } = user;
  return rest;
}

export async function verifyUserAccess(request: Request): Promise<{
  id: string;
  email: string;
  createdAt: Date;
  isAdmin: boolean;
}> {
  const auth = request.headers.get("authorization");
  if (!auth) throw new Response("Unauthorized", { status: 401 });
  const [tokenType, token] = auth.split(/\s+/);
  if (tokenType !== "Bearer")
    throw new Response("Unauthorized", { status: 401 });

  const userId = parseTokenUserId(token);
  if (!userId) throw new Response("Not found", { status: 404 });

  const user = await prisma.user.findFirst({
    where: { id: userId, apiKey: token },
    select: { id: true, email: true, createdAt: true, isAdmin: true },
  });
  if (!user) throw new Response("Not found", { status: 404 });
  return user;
}

export async function verifySiteAccess({
  domain,
  request,
}: {
  domain: string;
  request: Request;
}): Promise<{
  id: string;
  domain: string;
  createdAt: Date;
}> {
  const { id: userId } = await verifyUserAccess(request);

  const site = await prisma.site.findFirst({
    where: {
      domain,
      OR: [{ ownerId: userId }, { siteUsers: { some: { userId } } }],
    },
    select: { id: true, domain: true, createdAt: true },
  });
  if (!site) throw new Response("Not found", { status: 404 });
  return site;
}
