import {
  WeeklyDigestEmail,
  loadWeeklyDigestMetrics,
} from "~/emails/WeeklyDigest";
import type { Route } from "./+types/[_]preview";

export async function loader() {
  const siteId = "cmmi2yfwi000404l9qcci3j0x";
  return loadWeeklyDigestMetrics(siteId);
}

export default function WeeklyDigest({ loaderData }: Route.MetaArgs) {
  return <WeeklyDigestEmail {...loaderData} />;
}
