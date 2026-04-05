import type { Route } from "./+types/api.me";
import { verifyUserAccess } from "~/lib/api/apiAuth.server";
import { UserSchema } from "~/lib/api/openapi";
import { data } from "react-router";
import prisma from "~/lib/prisma.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { id, email } = await verifyUserAccess(request);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      email: true,
      ownedSites: { select: { domain: true, createdAt: true, summary: true } },
      siteUsers: {
        select: {
          site: { select: { domain: true, createdAt: true, summary: true } },
        },
      },
    },
  });
  const sites = [...user.ownedSites, ...user.siteUsers.map(({ site }) => site)];
  return data(
    UserSchema.parse({
      id,
      email,
      sites: sites.map(({ summary, domain, createdAt }) => ({
        createdAt: createdAt.toISOString().split("T")[0],
        domain,
        summary,
      })),
    }),
  );
}
