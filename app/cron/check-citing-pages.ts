import { convert } from "convert";
import checkCitingPagesFn from "~/lib/llm-visibility/checkCitingPages";

export const schedule = "0 6 * * *";
export const timeout = convert(10, "minutes").to("seconds");

async function main() {
  console.info("Checking citing pages (staleDays=7, limit=500)...");
  const results = await checkCitingPagesFn({ staleDays: 7, limit: 500 });
  console.info(`Done: checked ${results.length} pages`);
  return { checked: results.length };
}

if (import.meta.main) await main();

export default main;
