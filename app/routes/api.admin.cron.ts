import fs from "node:fs";
import path from "node:path";
import { data } from "react-router";
import { requireAdmin } from "~/lib/api/apiAuth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/api.admin.cron";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const tasks = loadTasks();

  const lastRun = await prisma.cronRun.groupBy({
    by: ["job"],
    _max: { startedAt: true },
  });

  const recentRuns = await prisma.cronRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 200,
  });

  const runsByJob = new Map<string, typeof recentRuns>();
  for (const run of recentRuns) {
    const list = runsByJob.get(run.job);
    if (list) list.push(run);
    else runsByJob.set(run.job, [run]);
  }

  const health = await prisma.cronRun.groupBy({
    by: ["job", "status"],
    _count: { id: true },
    where: {
      startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  });

  const healthByJob = new Map<string, { completed: number; failed: number }>();
  for (const h of health) {
    const entry = healthByJob.get(h.job) ?? { completed: 0, failed: 0 };
    if (h.status === "completed") entry.completed += h._count.id;
    if (h.status === "failed") entry.failed += h._count.id;
    healthByJob.set(h.job, entry);
  }

  return data({
    tasks: tasks.map((task) => {
      const h = healthByJob.get(task.name);
      const last = lastRun.find((r) => r.job === task.name)?._max.startedAt ?? null;
      return {
        name: task.name,
        schedule: task.schedule,
        timeout: task.timeout,
        skip: task.skip ?? false,
        lastRun: last?.toISOString() ?? null,
        recentRuns: (runsByJob.get(task.name) ?? []).slice(0, 20).map((r) => ({
          status: r.status,
          startedAt: r.startedAt.toISOString(),
          finishedAt: r.finishedAt.toISOString(),
          durationMs: r.durationMs,
          error: r.error ?? undefined,
        })),
        health: {
          completed: h?.completed ?? 0,
          failed: h?.failed ?? 0,
        },
      };
    }),
  });
}

function loadTasks(): {
  name: string;
  schedule: string;
  timeout: number;
  skip: boolean;
}[] {
  const configPath = path.resolve(process.cwd(), "build", "cron-config.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw);
}
