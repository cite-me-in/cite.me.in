import { data } from "react-router";
import { verifySiteAccess } from "~/lib/api/apiAuth.server";
import { SiteSchema } from "~/lib/api/schemas";
import type { Route } from "./+types/api.sites.$domain";

export async function loader({ request, params }: Route.LoaderArgs) {
  const site = await verifySiteAccess({ domain: params.domain, request });

  return data(
    SiteSchema.parse({
      domain: site.domain,
      createdAt: site.createdAt.toISOString().split("T")[0],
      users: [
        {
          id: site.owner.id,
          email: site.owner.email,
          role: "owner" as const,
        },
        ...site.siteUsers.map(({ user }) => ({
          id: user.id,
          email: user.email,
          role: "member" as const,
        })),
      ],
    }),
  );
}
