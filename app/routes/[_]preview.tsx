import { WeeklyDigestEmail } from "~/emails/WeeklyDigest";
import { loadWeeklyDigestMetrics } from "~/lib/weeklyDigest.server";
import type { Route } from "./+types/[_]preview";

export async function loader() {
  const siteId = "cmmi2yfwi000404l9qcci3j0x";
  return await loadWeeklyDigestMetrics(siteId);
}

export default function WeeklyDigest({ loaderData }: Route.MetaArgs) {
  return <WeeklyDigestEmail {...loaderData} />;
}
