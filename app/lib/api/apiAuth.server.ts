import prisma from "~/lib/prisma.server";
import envVars from "../envVars";

export async function requireAdminApiKey(request: Request): Promise<void> {
  const auth = request.headers.get("authorization");
  if (!auth) throw new Response("Unauthorized", { status: 401 });
  const [tokenType, token] = auth.split(/\s+/);
  if (tokenType !== "Bearer")
    throw new Response("Unauthorized", { status: 401 });
  if (!envVars.ADMIN_API_SECRET || token !== envVars.ADMIN_API_SECRET)
    throw new Response("Unauthorized", { status: 401 });
}

export async function verifyUserAccess({
  email,
  request,
}: {
  email: string;
  request: Request;
}): Promise<{
  id: string;
  email: string;
  createdAt: Date;
}> {
  const auth = request.headers.get("authorization");
  if (!auth) throw new Response("Unauthorized", { status: 401 });
  const [tokenType, token] = auth.split(/\s+/);
  if (tokenType !== "Bearer")
    throw new Response("Unauthorized", { status: 401 });

  const user = await prisma.user.findFirst({
    where: { email, apiKey: token },
    select: {
      id: true,
      email: true,
      createdAt: true,
    },
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
  const auth = request.headers.get("authorization");
  if (!auth) throw new Response("Unauthorized", { status: 401 });
  const [tokenType, token] = auth.split(/\s+/);
  if (tokenType !== "Bearer")
    throw new Response("Unauthorized", { status: 401 });

  const site = await prisma.site.findFirst({
    where: {
      domain,
      OR: [
        { owner: { apiKey: token } },
        { siteUsers: { some: { user: { apiKey: token } } } },
      ],
    },
    select: {
      id: true,
      domain: true,
      createdAt: true,
    },
  });
  if (!site) throw new Response("Forbidden", { status: 403 });
  return site;
}
