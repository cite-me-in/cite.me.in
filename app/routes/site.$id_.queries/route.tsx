export const handle = { siteNav: true };

import { captureException } from "@sentry/react-router";
import SitePageHeader from "~/components/ui/SitePageHeader";
import { requireUser } from "~/lib/auth.server";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";
import AddGroup from "./AddGroup";
import GroupSection from "./GroupSection";
import SuggestedQueries from "./SuggestedQueries";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Citation Queries — ${data?.site.domain} | CiteUp` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const site = await prisma.site.findFirst({
    where: { id: params.id, accountId: user.accountId },
  });
  if (!site) throw new Response("Not found", { status: 404 });

  const rows = await prisma.siteQuery.findMany({
    where: { siteId: site.id },
    orderBy: [{ group: "asc" }, { createdAt: "asc" }],
  });

  const map: Record<string, typeof rows> = {};
  for (const r of rows) {
    if (!map[r.group]) map[r.group] = [];
    map[r.group].push(r);
  }
  const groups = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));

  return { site, groups };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const site = await prisma.site.findFirst({
    where: { id: params.id, accountId: user.accountId },
  });
  if (!site) throw new Response("Not found", { status: 404 });

  const data = await request.formData();
  const intent = String(data.get("_intent"));

  switch (intent) {
    case "add-group": {
      const group = String(data.get("group")).trim();
      if (!group)
        return { ok: false as const, error: "Group name is required" };
      await prisma.siteQuery.create({
        data: { siteId: site.id, group, query: "" },
      });
      return { ok: true as const };
    }
    case "rename-group": {
      const oldGroup = String(data.get("oldGroup"));
      const newGroup = String(data.get("newGroup")).trim();
      if (!newGroup || newGroup === oldGroup) return { ok: true as const };
      await prisma.siteQuery.updateMany({
        where: { siteId: site.id, group: oldGroup },
        data: { group: newGroup },
      });
      return { ok: true as const };
    }
    case "delete-group": {
      const group = String(data.get("group"));
      await prisma.siteQuery.deleteMany({ where: { siteId: site.id, group } });
      return { ok: true as const };
    }
    case "add-query": {
      const group = String(data.get("group"));
      const query = String(data.get("query") ?? "");
      await prisma.siteQuery.create({
        data: { siteId: site.id, group, query },
      });
      return { ok: true as const };
    }
    case "update-query": {
      const id = String(data.get("id"));
      const query = String(data.get("query"));
      const existing = await prisma.siteQuery.findFirst({
        where: { id, siteId: site.id },
      });
      if (!existing) return { ok: false as const, error: "Query not found" };
      await prisma.siteQuery.update({ where: { id }, data: { query } });
      return { ok: true as const };
    }
    case "delete-query": {
      const id = String(data.get("id"));
      const existing = await prisma.siteQuery.findFirst({
        where: { id, siteId: site.id },
      });
      if (!existing) return { ok: false as const, error: "Query not found" };
      await prisma.siteQuery.delete({ where: { id } });
      return { ok: true as const };
    }
    case "suggest": {
      if (!site.content)
        return {
          ok: false as const,
          error: "No site content available to generate suggestions from.",
        };
      try {
        const suggestions = await generateSiteQueries(site.content);
        return { ok: true as const, suggestions };
      } catch (error) {
        captureException(error, { extra: { siteId: site.id } });
        return {
          ok: false as const,
          error: "Couldn't generate suggestions. Please try again.",
        };
      }
    }
  }

  return { ok: false as const, error: "Unknown action" };
}

export default function SiteQueriesPage({ loaderData }: Route.ComponentProps) {
  const { site, groups } = loaderData;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <SitePageHeader site={site} title="Citation Queries" />

      <p className="text-base text-foreground/60">
        These queries are run against AI platforms to check where your site is
        cited. Organize them into groups by topic or intent (e.g.{" "}
        <code className="font-mono">1. discovery</code>,{" "}
        <code className="font-mono">2. active_search</code>).
      </p>

      <SuggestedQueries hasContent={!!site.content} />

      <div className="space-y-4">
        {groups.length === 0 ? (
          <div className="rounded-base border-2 border-black bg-secondary-background p-12 text-center shadow-shadow">
            <p className="mb-2 font-bold text-xl">No queries yet</p>
            <p className="text-base text-foreground/60">
              Add groups and queries to track your citation visibility across AI
              platforms.
            </p>
          </div>
        ) : (
          groups.map(([group, queries]) => (
            <GroupSection key={group} group={group} queries={queries} />
          ))
        )}

        <AddGroup />
      </div>
    </main>
  );
}
