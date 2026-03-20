import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SitePageHeader";
import addSiteQueries, {
  addSiteQueryGroup,
  renameSiteQueryGroup,
  runQueryOnAllPlatforms,
  updateSiteQuery,
} from "~/lib/addSiteQueries";
import { requireUser } from "~/lib/auth.server";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
import {
  hasWordChanges,
  isMeaningfulSentence,
} from "~/lib/llm-visibility/queryValidation";
import logError from "~/lib/logError.server";
import prisma from "~/lib/prisma.server";
import { requireSiteAccess } from "~/lib/sites.server";
import type { Route } from "./+types/route";
import AddQueriesGroup from "./AddQueriesGroup";
import GroupOfQueries from "./GroupOfQueries";
import SuggestedQueries from "./SuggestedQueries";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `Citation Queries — ${loaderData?.site.domain} | Cite.me.in` },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const site = await requireSiteAccess(params.domain, user.id);

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
  const site = await requireSiteAccess(params.domain, user.id);

  const data = await request.formData();
  const intent = data.get("_intent")?.toString();

  switch (intent) {
    case "add-group": {
      const group = data.get("group")?.toString().trim();
      if (!group) return { ok: false, error: "Group name is required" };
      await addSiteQueryGroup(site, group);
      return { ok: true };
    }
    case "rename-group": {
      const oldGroup = data.get("oldGroup")?.toString() ?? "";
      const newGroup = data.get("newGroup")?.toString() ?? "";
      await renameSiteQueryGroup({ site, oldGroup, newGroup });
      return { ok: true };
    }
    case "delete-group": {
      const group = data.get("group")?.toString();
      await prisma.siteQuery.deleteMany({ where: { siteId: site.id, group } });
      return { ok: true };
    }
    case "add-query": {
      const group = data.get("group")?.toString() ?? "";
      const query = data.get("query")?.toString() ?? "";
      await addSiteQueries(site, [{ group, query }]);
      if (isMeaningfulSentence(query))
        try {
          await runQueryOnAllPlatforms({ site, query, group });
        } catch (error) {
          logError(error, { extra: { siteId: site.id } });
        }
      return { ok: true as const };
    }
    case "update-query": {
      const id = data.get("id")?.toString() ?? "";
      const query = data.get("query")?.toString() ?? "";
      const existing = await prisma.siteQuery.findFirst({
        where: { id, siteId: site.id },
      });
      if (!existing) return { ok: false as const, error: "Query not found" };
      await updateSiteQuery(id, query.trim().replace(/\s+/g, " "));
      if (isMeaningfulSentence(query) && hasWordChanges(existing.query, query))
        try {
          await runQueryOnAllPlatforms({ site, query, group: existing.group });
        } catch (error) {
          logError(error, { extra: { siteId: site.id } });
        }
      return { ok: true as const };
    }
    case "delete-query": {
      const id = data.get("id")?.toString();
      const existing = await prisma.siteQuery.findFirst({
        where: { id, siteId: site.id },
      });
      if (!existing) return { ok: false, error: "Query not found" };
      await prisma.siteQuery.delete({ where: { id } });
      return { ok: true };
    }
    case "suggest": {
      try {
        const suggestions = await generateSiteQueries(site);
        return { ok: true, suggestions };
      } catch (error) {
        logError(error, { extra: { siteId: site.id } });
        return {
          ok: false,
          error: "Couldn't generate suggestions. Please try again.",
        };
      }
    }
  }

  return { ok: false, error: "Unknown action" };
}

export default function SiteQueriesPage({ loaderData }: Route.ComponentProps) {
  const { site, groups } = loaderData;

  return (
    <Main variant="wide">
      <SitePageHeader
        site={site}
        title="Citation Queries"
        backTo={{ label: "Citations", path: `/site/${site.domain}/citations` }}
      />

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
            <GroupOfQueries key={group} group={group} queries={queries} />
          ))
        )}

        <AddQueriesGroup />
      </div>
    </Main>
  );
}
