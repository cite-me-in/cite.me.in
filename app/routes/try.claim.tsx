import { redirect } from "react-router";
import { requireUserAccess } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import { createSite, extractDomain } from "~/lib/sites.server";
import type { Route } from "./+types/try.claim";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUserAccess(request);

  const url = new URL(request.url);
  const rawDomain = url.searchParams.get("domain") ?? "";
  const domain = extractDomain(rawDomain);
  if (!domain) throw redirect("/sites");

  const existing = await prisma.site.findFirst({
    where: { domain, ownerId: user.id },
  });
  if (existing) throw redirect(`/site/${domain}/citations`);

  const site = await createSite({ user, domain });
  throw redirect(`/site/${site.domain}/setup`);
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUserAccess(request);

  const form = await request.formData();
  const rawDomain = (form.get("domain") as string)?.trim() ?? "";
  const domain = extractDomain(rawDomain);
  if (!domain) return { error: "Enter a valid website URL" };

  const existing = await prisma.site.findFirst({
    where: { domain, ownerId: user.id },
  });
  if (existing) throw redirect(`/site/${domain}/citations`);

  const site = await createSite({ user, domain });
  throw redirect(`/site/${site.domain}/setup`);
}

export default function ClaimPage() {
  return null;
}
