import fs from "node:fs";
import path from "node:path";
import invariant from "tiny-invariant";
import type { CronTaskConfig } from "./types";

if (import.meta.main) await main();

async function syncTasks(
  tasks: CronTaskConfig[],
  {
    coolifyURL,
    token,
    appUUID,
  }: { coolifyURL: string; token: string; appUUID: string },
): Promise<void> {
  const existing = await api<
    {
      command: string;
      enabled: boolean;
      frequency: string;
      name: string;
      timeout: number;
      uuid: string;
    }[]
  >({
    coolifyURL,
    method: "GET",
    pathname: `/api/v1/applications/${appUUID}/scheduled-tasks`,
    token,
  });
  invariant(existing, "Failed to fetch existing scheduled tasks");

  const existingByName = new Map(existing.map((task) => [task.name, task]));
  const desiredByName = new Map(tasks.map((task) => [task.name, task]));

  for (const task of tasks) {
    const command = `pnpm tsx app/cron/${task.name}.ts`;
    const existingTask = existingByName.get(task.name);

    if (existingTask) {
      const needsUpdate =
        existingTask.command !== command ||
        existingTask.frequency !== task.schedule ||
        existingTask.timeout !== task.timeout;

      if (needsUpdate) {
        console.info(`Updating scheduled task: ${task.name}`);
        await api({
          body: {
            command,
            frequency: task.schedule,
            name: task.name,
            timeout: task.timeout,
          },
          coolifyURL,
          method: "PATCH",
          pathname: `/api/v1/applications/${appUUID}/scheduled-tasks/${existingTask.uuid}`,
          token,
        });
      } else console.info(`Scheduled task up to date: ${task.name}`);
    } else {
      console.info(`Creating scheduled task: ${task.name}`);
      await api({
        body: {
          name: task.name,
          command,
          frequency: task.schedule,
          timeout: task.timeout,
        },
        coolifyURL,
        method: "POST",
        pathname: `/api/v1/applications/${appUUID}/scheduled-tasks`,
        token,
      });
    }
  }

  for (const existingTask of existing) {
    if (!desiredByName.has(existingTask.name)) {
      console.info(`Deleting scheduled task: ${existingTask.name}`);
      await api({
        coolifyURL,
        method: "DELETE",
        pathname: `/api/v1/applications/${appUUID}/scheduled-tasks/${existingTask.uuid}`,
        token,
      });
    }
  }
}

async function api<T>({
  coolifyURL,
  token,
  method,
  pathname,
  body,
}: {
  coolifyURL: string;
  token: string;
  method: string;
  pathname: string;
  body?: unknown;
}): Promise<T | null> {
  const url = new URL(pathname, coolifyURL);
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Coolify API ${method} ${pathname}: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function main() {
  const args = process.argv.slice(2);

  const coolifyURL = flag(args, "--coolify") ?? process.env.COOLIFY_URL;
  const token = flag(args, "--token") ?? process.env.COOLIFY_TOKEN;
  const appUUID = flag(args, "--app") ?? process.env.COOLIFY_APP_UUID;

  const missing: string[] = [];
  if (!coolifyURL) missing.push("--coolify (or COOLIFY_URL env)");
  if (!token) missing.push("--token (or COOLIFY_TOKEN env)");
  if (!appUUID) missing.push("--app (or COOLIFY_APP_UUID env)");
  if (missing.length > 0) {
    console.error(`Missing required arguments: ${missing.join(", ")}`);
    process.exit(1);
  }

  const configPath = path.resolve("build/cron-config.json");
  const tasks = JSON.parse(
    fs.readFileSync(configPath, "utf-8"),
  ) as CronTaskConfig[];

  console.info(`Syncing ${tasks.length} cron tasks to ${appUUID}...`);
  await syncTasks(tasks, {
    coolifyURL: coolifyURL!,
    token: token!,
    appUUID: appUUID!,
  });
  console.info("Done.");
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}
