import { daysAgo } from "./formatDate";

type Plan = "trial" | "paid" | "cancelled" | "gratis";

// Days a trial user can access processing and digest.
export const TRIAL_DAYS = 25;

// How many hours must pass before a site is processed again, per tier.
// trial: once per week (tied to the digest run)
// paid/gratis: once per day
// cancelled: never
export function processingIntervalHours(plan: Plan): number {
  if (plan === "trial") return 7 * 24;
  if (plan === "paid" || plan === "gratis") return 24;
  return Number.POSITIVE_INFINITY;
}

/**
 * Returns true if the lastProcessedAt is before the earliest date for the plan.
 * Trials have to wait 7 days, paid and gratis have to wait 1 day.
 * Cancelled users can never be processed.
 * @param plan - The plan of the user
 * @param lastProcessedAt - The lastProcessedAt date of the site
 * @returns true if the site should be processed
 */
export function canLastProcess({
  lastProcessedAt,
  plan,
}: {
  lastProcessedAt: Date | null;
  plan: Plan;
}): boolean {
  const before =
    plan === "trial"
      ? daysAgo(7)
      : plan === "paid" || plan === "gratis"
        ? daysAgo(1)
        : new Date();
  return !lastProcessedAt || lastProcessedAt < before;
}

// Whether a site should be processed right now.
// Trial expires after TRIAL_DAYS — no processing after that.
export function isProcessingEligible(user: {
  plan: Plan;
  createdAt: Date;
}): boolean {
  if (user.plan === "cancelled") return false;
  if (user.plan === "trial") return daysSince(user.createdAt) < TRIAL_DAYS;
  return true; // paid, gratis
}

// Whether to send the weekly digest to this user's sites.
// Same eligibility as processing.
export function isDigestEligible(user: {
  plan: Plan;
  createdAt: Date;
}): boolean {
  return isProcessingEligible(user);
}

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}
