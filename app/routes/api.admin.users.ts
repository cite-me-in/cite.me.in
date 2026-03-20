import { data } from "react-router";
import z from "zod";
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
      })),
    }),
  );
}

const AdminUsersSchema = z.object({
  users: z
    .array(
      z
        .object({
          id: z.string().openapi({ example: "clxyz123" }),
          email: z.email().openapi({ example: "user@example.com" }),
          createdAt: z.iso.date().openapi({ example: "2024-01-01" }),
          status: z
            .enum(["free_trial", "active", "cancelled"])
            .openapi({ example: "free_trial" }),
          plan: z
            .enum(["monthly", "yearly"])
            .nullable()
            .openapi({ example: "monthly" }),
          sites: z.array(
            z
              .object({
                domain: z.string().openapi({ example: "example.com" }),
                createdAt: z.iso.date().openapi({ example: "2024-01-01" }),
              })
              .openapi("Site"),
          ),
        })
        .openapi("User"),
    )
    .openapi("AdminUsers"),
});
