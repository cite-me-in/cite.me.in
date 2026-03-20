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
      account: {
        select: {
          status: true,
          interval: true,
          updatedAt: true,
          stripeCustomerId: true,
        },
      },
      ownedSites: {
        select: { domain: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return data({
    users: users.map(({ ownedSites, account, ...user }) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      stripe: account
        ? {
            status: account.status,
            interval: account.interval,
            updatedAt: account.updatedAt,
            customerId: account.stripeCustomerId,
          }
        : null,
      sites: ownedSites.map(({ domain, createdAt }) => ({
        createdAt,
        domain,
      })),
    })),
  });
}
