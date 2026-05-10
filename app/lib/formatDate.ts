import { Temporal } from "@js-temporal/polyfill";

const mediumDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const fullDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * Formats a date to "Mar 23"
 * @example
 * formatDateShort(new Date("2026-03-23")) // "Mar 23"
 */
export function formatDateShort(date: Date | Temporal.PlainDate): string {
  return shortDate.format(new Date(date.toJSON()));
}

/**
 * Formats a date to "Mar 23, 2026"
 * @example
 * formatDateMed(new Date("2026-03-23")) // "Mar 23, 2026"
 */
export function formatDateMed(date: Date): string {
  return mediumDate.format(date);
}

/**
 * Formats a date to "Monday, March 23, 2026"
 * @example
 * formatDateHuge(new Date("2026-03-23")) // "Monday, March 23, 2026"
 */
export function formatDateHuge(date: Date): string {
  return fullDate.format(date);
}

/**
 * Returns the date that is the number of hours ago
 *
 * @param hours - The number of hours to subtract from the current date
 * @returns The date that is the number of hours ago
 * @example
 * hoursAgo(1) // The date that is 1 hour ago
 */
export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
