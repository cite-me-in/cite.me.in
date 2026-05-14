import fs from "node:fs";
import path from "node:path";
import { loadCronTasks } from "./loadTasks";

const outputPath = path.resolve("build", "cron-config.json");

/**
 * Post-build step: extracts cron configs from app/cron/*.ts source files
 * and writes build/cron-config.json for the admin API route to read at runtime.
 */
export async function writeCronConfig(): Promise<void> {
  const tasks = loadCronTasks();
  const json = JSON.stringify(tasks, null, 2);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, json, "utf-8");
  console.info(`Wrote cron config: ${outputPath}`);
}
