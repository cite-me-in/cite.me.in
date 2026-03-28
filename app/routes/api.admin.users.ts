import { data } from "react-router";
import z from "zod";
import { requireAdmin } from "~/lib/api/apiAuth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/api.admin.users";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

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
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return data(
    AdminUsersSchema.parse({
      users: users.map(({ ownedSites, account, ...user }) => ({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString().split("T")[0],
        status: account?.status ?? "free_trial",
        plan: account?.status === "active" ? account?.interval : null,
        sites: ownedSites.map(({ domain, createdAt }) => ({
          createdAt: createdAt.toISOString().split("T")[0],
          domain,
        })),
        updatedAt: new Date(
          Math.max(
            ...[account?.updatedAt, user.updatedAt].map(
              (date) => date?.getTime() ?? 0,
            ),
          ),
        )
          .toISOString()
          .split("T")[0],
      })),
    }),
  );
}

const AdminUsersSchema = z.object({
  users: z.array(
    z.object({
      createdAt: z.iso.date(),
      email: z.email(),
      id: z.string(),
      plan: z.enum(["monthly", "yearly"]).nullable(),
      sites: z.array(z.object({ createdAt: z.iso.date(), domain: z.string() })),
      status: z.enum(["free_trial", "active", "cancelled"]),
      updatedAt: z.iso.date(),
    }),
  ),
});
