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
  users: z
    .array(
      z
        .object({
          createdAt: z.iso.date().openapi({ example: "2024-01-01" }),
          email: z.email().openapi({ example: "user@example.com" }),
          id: z.string().openapi({ example: "clxyz123" }),
          plan: z
            .enum(["monthly", "yearly"])
            .nullable()
            .openapi({ example: "monthly" }),
          sites: z.array(
            z
              .object({
                createdAt: z.iso.date().openapi({ example: "2024-01-01" }),
                domain: z.string().openapi({ example: "example.com" }),
              })
              .openapi("Site"),
          ),
          status: z
            .enum(["free_trial", "active", "cancelled"])
            .openapi({ example: "free_trial" }),
          updatedAt: z.iso.date().openapi({ example: "2024-01-01" }),
        })
        .openapi("User"),
    )
    .openapi("AdminUsers"),
});
