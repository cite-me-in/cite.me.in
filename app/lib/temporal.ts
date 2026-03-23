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
export function formatDateShort(date: Date): string {
  return shortDate.format(date);
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
