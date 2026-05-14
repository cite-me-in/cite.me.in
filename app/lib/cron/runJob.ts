import prisma from "~/lib/prisma.server";
import type { Prisma } from "~/prisma";

export async function runJob(jobName: string, fn: () => Promise<unknown>): Promise<void> {
  const startedAt = new Date();
  try {
    const result = await fn();
    const finishedAt = new Date();
    await prisma.cronRun.create({
      data: {
        job: jobName,
        status: "completed",
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        details: result as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    const finishedAt = new Date();
    const errorMessage = error instanceof Error ? error.message : String(error);
    await prisma.cronRun.create({
      data: {
        job: jobName,
        status: "failed",
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        error: errorMessage,
      },
    });
    console.error(`Cron job "${jobName}" failed:`, errorMessage);
    process.exit(1);
  }
}
