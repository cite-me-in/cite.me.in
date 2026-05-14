import { convert } from "convert";
import checkCitingPagesFn from "~/lib/llm-visibility/checkCitingPages";

export const schedule = "0 6 * * *";
export const timeout = convert(10, "minutes").to("seconds");

async function main() {
  const results = await checkCitingPagesFn({ staleDays: 7, limit: 500 });
  return { checked: results.length };
}

if (import.meta.main) await main();

export default main;
