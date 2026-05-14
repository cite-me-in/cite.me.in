import debug from "debug";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SiteHeading";
import addSiteQueries, {
  addSiteQueryGroup,
  renameSiteQueryGroup,
  runQueryOnAllPlatforms,
  updateSiteQuery,
} from "~/lib/addSiteQueries";
import { requireSiteAccess } from "~/lib/auth.server";
import captureAndLogError from "~/lib/captureAndLogError.server";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
import { hasWordChanges, isMeaningfulSentence } from "~/lib/llm-visibility/queryValidation";
import upsertCitingPages from "~/lib/llm-visibility/upsertCitingPages";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";
import AddQueriesGroup from "./AddQueriesGroup";
import GroupOfQueries from "./GroupOfQueries";
import SuggestedQueries from "./SuggestedQueries";

const logger = debug("server");

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Citation Queries — ${loaderData?.site.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site } = await requireSiteAccess({ domain: params.domain, request });

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
  const { site } = await requireSiteAccess({ domain: params.domain, request });

  const data = await request.formData();
  const intent = data.get("_intent") as string;

  switch (intent) {
    case "add-group": {
      const group = data.get("group") as string;
      if (!group) return { ok: false, error: "Group name is required" };
      await addSiteQueryGroup(site, group);
      return { ok: true };
    }
    case "rename-group": {
      const oldGroup = data.get("oldGroup") as string;
      const newGroup = data.get("newGroup") as string;
      await renameSiteQueryGroup({ site, oldGroup, newGroup });
      return { ok: true };
    }
    case "delete-group": {
      const group = data.get("group") as string;
      await prisma.siteQuery.deleteMany({ where: { siteId: site.id, group } });
      return { ok: true };
    }
    case "add-query": {
      const group = data.get("group") as string;
      const query = data.get("query") as string;
      await addSiteQueries(site, [{ group, query }]);
      if (isMeaningfulSentence(query))
        try {
          await runQueryOnAllPlatforms({ site, query, group, log: logger });
          await upsertCitingPages({ log: logger, site });
        } catch (error) {
          captureAndLogError(error, { extra: { siteId: site.id } });
        }
      return { ok: true as const };
    }
    case "update-query": {
      const id = data.get("id") as string;
      const query = data.get("query") as string;
      const existing = await prisma.siteQuery.findFirst({
        where: { id, siteId: site.id },
      });
      if (!existing) return { ok: false as const, error: "Query not found" };
      await updateSiteQuery(id, query.trim().replace(/\s+/g, " "));
      if (isMeaningfulSentence(query) && hasWordChanges(existing.query, query))
        try {
          await runQueryOnAllPlatforms({
            site,
            query,
            group: existing.group,
            log: logger,
          });
          await upsertCitingPages({ log: logger, site });
        } catch (error) {
          captureAndLogError(error, { extra: { siteId: site.id } });
        }
      return { ok: true as const };
    }
    case "delete-query": {
      const id = data.get("id") as string;
      const existing = await prisma.siteQuery.findFirst({
        where: { id, siteId: site.id },
      });
      if (!existing) return { ok: false, error: "Query not found" };
      await prisma.siteQuery.delete({ where: { id } });
      return { ok: true };
    }
    case "suggest": {
      try {
        const suggestions = await generateSiteQueries(site.id);
        return { ok: true, suggestions };
      } catch (error) {
        captureAndLogError(error, { extra: { siteId: site.id } });
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
        title="Queries for citation visibility"
        backTo={{
          label: "View citations",
          path: `/site/${site.domain}/citations`,
        }}
      />

      <p className="text-foreground/60 text-base">
        These queries are run against AI platforms to check where your site is cited. Organize them
        into groups by topic or intent (e.g. <code className="font-mono">1. discovery</code>,{" "}
        <code className="font-mono">2. active_search</code>).
      </p>

      <SuggestedQueries />

      <div className="space-y-4">
        {groups.length === 0 ? (
          <div className="rounded-base bg-secondary-background shadow-shadow border-2 border-black p-12 text-center">
            <p className="mb-2 text-xl font-bold">No queries yet</p>
            <p className="text-foreground/60 text-base">
              Add groups and queries to track your citation visibility across AI platforms.
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
