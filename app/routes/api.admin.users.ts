import { data } from "react-router";
import { requireAdminApiKey } from "~/lib/api/apiAuth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/api.admin.users";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdminApiKey(request);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      createdAt: true,
      ownedSites: {
        select: { domain: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return data({
    users: users.map(({ ownedSites, ...user }) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      sites: ownedSites.map(({ domain, createdAt }) => ({
        createdAt,
        domain,
      })),
    })),
  });
}
