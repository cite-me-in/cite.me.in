/**
 * whenwords - Human-friendly time formatting and parsing
 * Specification v0.1.0
 */

/**
 * Returns a human-readable relative time string like "3 hours ago" or "in 2 days"
 *
 * @param timestamp - The timestamp to format (Unix milliseconds, ISO 8601
 * string, or Date)
 * @param reference - Optional reference time (defaults to timestamp itself,
 * returning "just now")
 * @returns Human-readable relative time string
 *
 * @example
 * timeago(Date.now()  - 60 * 60 * 1000, Date.now()) // "1 hour ago"
 * timeago(Date.now() + 2 * 60 * 60 * 1000, Date.now()) // "in 2 hours"
 */
function agoOrIn(phrase: string, isPast: boolean): string {
  return isPast ? `${phrase} ago` : `in ${phrase}`;
}

export function timeago(
  timestamp: number | string | Date,
  reference?: number | string | Date,
): string {
  const ts = normalizeTimestamp(timestamp);
  const ref = reference !== undefined ? normalizeTimestamp(reference) : ts;

  const absDiffSec = Math.floor(Math.abs((ref - ts) / 1000));
  const isPast = ts < ref;

  // Thresholds and logic for past times
  if (absDiffSec < 45) return "just now";
  if (absDiffSec < 90) return agoOrIn("1 minute", isPast);
  if (absDiffSec < 45 * 60) return agoOrIn(`${Math.round(absDiffSec / 60)} minutes`, isPast);
  if (absDiffSec < 90 * 60) return agoOrIn("1 hour", isPast);
  if (absDiffSec < 22 * 3600) return agoOrIn(`${Math.round(absDiffSec / 3600)} hours`, isPast);
  if (absDiffSec < 36 * 3600) return agoOrIn("1 day", isPast);
  if (absDiffSec < 26 * 86400) return agoOrIn(`${Math.round(absDiffSec / 86400)} days`, isPast);
  if (absDiffSec < 46 * 86400) return agoOrIn("1 month", isPast);
  if (absDiffSec < 320 * 86400) {
    const days = absDiffSec / 86400;
    const months = Math.min(Math.round(days / 30), 10);
    return agoOrIn(`${months} months`, isPast);
  }
  if (absDiffSec < 548 * 86400) return agoOrIn("1 year", isPast);

  const years = Math.round(absDiffSec / (365 * 24 * 60 * 60));
  return agoOrIn(`${years} years`, isPast);
}

/**
 * Formats a duration in seconds as a human-readable string
 *
 * @param milliseconds - Non-negative duration in milliseconds
 * @param options - Formatting options
 *   - compact: If true, use "2h 30m" style instead of "2 hours, 30 minutes"
 *   - max_units: Maximum number of units to display (default: 2)
 * @returns Human-readable duration string
 *
 * @example
 * duration(3661) // "1 hour, 1 minute"
 * duration(3661, { compact: true }) // "1h 1m"
 * duration(3661, { max_units: 1 }) // "1 hour"
 */
export function duration(
  milliseconds: number,
  options: { compact?: boolean; max_units?: number } = {},
): string {
  if (milliseconds < 0 || Number.isNaN(milliseconds) || !Number.isFinite(milliseconds))
    throw new Error("Duration must be a non-negative finite number");

  const { compact = false, max_units = 2 } = options;

  if (milliseconds === 0) return compact ? "0s" : "0 seconds";

  const seconds = Math.floor(milliseconds / 1000);
  const units = [
    { name: "year", short: "y", seconds: 365 * 86400 },
    { name: "month", short: "mo", seconds: 30 * 86400 },
    { name: "day", short: "d", seconds: 86400 },
    { name: "hour", short: "h", seconds: 3600 },
    { name: "minute", short: "m", seconds: 60 },
    { name: "second", short: "s", seconds: 1 },
  ];

  const parts: string[] = [];
  let remaining = seconds;

  for (let i = 0; i < units.length; i++) {
    if (parts.length >= max_units) break;

    const unit = units[i];
    let value = Math.floor(remaining / unit.seconds);

    // Check if we have a value or if we're at the last possible unit with nothing yet
    const isLastPossibleUnit = i === units.length - 1;
    const hasValue = value > 0;
    const shouldAdd = hasValue || (isLastPossibleUnit && parts.length === 0);

    if (shouldAdd) {
      // If this will be the last unit we show (due to max_units), round it
      const willBeLastUnit = parts.length === max_units - 1;
      if (willBeLastUnit && hasValue)
        // Recalculate with rounding to include all remaining time
        value = Math.round(remaining / unit.seconds);

      if (compact) {
        parts.push(`${value}${unit.short}`);
      } else {
        const pluralized = value === 1 ? unit.name : `${unit.name}s`;
        parts.push(`${value} ${pluralized}`);
      }
      remaining -= value * unit.seconds;
    }
  }

  return compact ? parts.join(" ") : parts.join(", ");
}

/**
 * Parses a human-written duration string into seconds
 *
 * Accepts multiple formats:
 * - Compact: "2h30m", "2h 30m", "2h, 30m"
 * - Verbose: "2 hours 30 minutes", "2 hours and 30 minutes"
 * - Decimal: "2.5 hours", "1.5h"
 * - Colon notation: "2:30" (h:mm), "2:30:00" (h:mm:ss)
 *
 * @param input - Duration string to parse
 * @returns Duration in milliseconds
 * @throws Error if string is empty, unparseable, or results in negative duration
 *
 * @example
 * parseDuration("2h30m") // 9000000
 * parseDuration("2 hours 30 minutes") // 9000000
 * parseDuration("2.5 hours") // 9000000
 * parseDuration("2:30") // 9000000
 */
export function parseDuration(input: string): number {
  if (!input || input.trim() === "") throw new Error("Cannot parse empty duration string");

  const trimmed = input.trim();

  // Check for negative sign
  if (trimmed.includes("-") && trimmed.startsWith("-"))
    throw new Error("Duration cannot be negative");

  // Try colon notation first (h:mm or h:mm:ss)
  const colonMatch = trimmed.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (colonMatch) {
    const hours = Number.parseInt(colonMatch[1], 10);
    const minutes = Number.parseInt(colonMatch[2], 10);
    const seconds = colonMatch[3] ? Number.parseInt(colonMatch[3], 10) : 0;
    const total = hours * 3600 + minutes * 60 + seconds;
    if (total < 0) throw new Error("Duration cannot be negative");
    return total * 1000;
  }

  // Unit definitions with aliases
  const unitMap: Record<string, number> = {
    // Weeks
    w: 604800,
    wk: 604800,
    wks: 604800,
    week: 604800,
    weeks: 604800,
    // Days
    d: 86400,
    day: 86400,
    days: 86400,
    // Hours
    h: 3600,
    hr: 3600,
    hrs: 3600,
    hour: 3600,
    hours: 3600,
    // Minutes
    m: 60,
    min: 60,
    mins: 60,
    minute: 60,
    minutes: 60,
    // Seconds
    s: 1,
    sec: 1,
    secs: 1,
    second: 1,
    seconds: 1,
  };

  // Parse duration components
  // Match patterns like: "2h", "2 hours", "2.5h", "2.5 hours"
  const pattern = /(\d+(?:\.\d+)?)\s*([a-z]+)/gi;
  const matches = [...trimmed.matchAll(pattern)];

  if (matches.length === 0) throw new Error(`Cannot parse duration: ${input}`);

  let totalSeconds = 0;

  for (const match of matches) {
    const value = Number.parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    if (!(unit in unitMap)) throw new Error(`Unknown duration unit: ${unit}`);

    totalSeconds += value * unitMap[unit];
  }

  if (totalSeconds < 0) throw new Error("Duration cannot be negative");

  if (totalSeconds === 0) throw new Error(`Cannot parse duration: ${input}`);

  return totalSeconds * 1000;
}

/**
 * Returns a contextual date string like "Today", "Yesterday", "Last Monday", or "March 5"
 *
 * @param timestamp - The date to format (Unix milliseconds, ISO 8601 string, or Date)
 * @param reference - Optional reference time for comparison (defaults to timestamp)
 * @returns Contextual date string
 *
 * @example
 * humanDate(yesterday, now) // "Yesterday"
 * humanDate(lastFriday, now) // "Last Friday"
 * humanDate(someDate, now) // "March 5" or "March 5, 2023"
 */
export function humanDate(
  timestamp: number | string | Date,
  reference?: number | string | Date,
): string {
  const ts = normalizeTimestamp(timestamp);
  const ref = reference !== undefined ? normalizeTimestamp(reference) : ts;

  // Convert to UTC dates for comparison
  const targetDate = new Date(ts);
  const refDate = new Date(ref);

  // Get UTC date components
  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth();
  const targetDay = targetDate.getUTCDate();

  const refYear = refDate.getUTCFullYear();
  const refMonth = refDate.getUTCMonth();
  const refDay = refDate.getUTCDate();

  // Calculate day difference
  const targetDayStart = Date.UTC(targetYear, targetMonth, targetDay);
  const refDayStart = Date.UTC(refYear, refMonth, refDay);
  const dayDiff = Math.round((refDayStart - targetDayStart) / 86400000);

  // Same day
  if (dayDiff === 0) return "Today";

  // Yesterday
  if (dayDiff === 1) return "Yesterday";

  // Tomorrow
  if (dayDiff === -1) return "Tomorrow";

  // Within past 7 days - "Last {weekday}"
  if (dayDiff > 1 && dayDiff <= 7) {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const weekday = weekdays[targetDate.getUTCDay()];
    return `Last ${weekday}`;
  }

  // Within next 7 days - "This {weekday}"
  if (dayDiff < -1 && dayDiff >= -7) {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const weekday = weekdays[targetDate.getUTCDay()];
    return `This ${weekday}`;
  }

  // Format as "Month day" or "Month day, year"
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const monthName = months[targetMonth];
  const sameYear = targetYear === refYear;

  if (sameYear) return `${monthName} ${targetDay}`;
  return `${monthName} ${targetDay}, ${targetYear}`;
}

/**
 * Formats a date range with smart abbreviation
 *
 * - Same day: "March 5, 2024"
 * - Same month: "March 5–7, 2024"
 * - Same year: "March 5 – April 7, 2024"
 * - Different years: "December 28, 2024 – January 3, 2025"
 *
 * @param start - Start timestamp (Unix milliseconds, ISO 8601 string, or Date)
 * @param end - End timestamp (Unix milliseconds, ISO 8601 string, or Date)
 * @returns Formatted date range string
 *
 * @example
 * dateRange(mar5, mar7) // "March 5–7, 2024"
 * dateRange(mar5, apr7) // "March 5 – April 7, 2024"
 * dateRange(dec28_2024, jan3_2025) // "December 28, 2024 – January 3, 2025"
 */
export function dateRange(start: number | string | Date, end: number | string | Date): string {
  let startTs = normalizeTimestamp(start);
  let endTs = normalizeTimestamp(end);

  // Swap if start is after end
  if (startTs > endTs) [startTs, endTs] = [endTs, startTs];

  const startDate = new Date(startTs);
  const endDate = new Date(endTs);

  const startYear = startDate.getUTCFullYear();
  const startMonth = startDate.getUTCMonth();
  const startDay = startDate.getUTCDate();

  const endYear = endDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth();
  const endDay = endDate.getUTCDate();

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const startMonthName = months[startMonth];
  const endMonthName = months[endMonth];

  // Same day
  if (startYear === endYear && startMonth === endMonth && startDay === endDay)
    return `${startMonthName} ${startDay}, ${startYear}`;

  // Same month
  if (startYear === endYear && startMonth === endMonth)
    return `${startMonthName} ${startDay}–${endDay}, ${startYear}`;

  // Same year
  if (startYear === endYear)
    return `${startMonthName} ${startDay} – ${endMonthName} ${endDay}, ${startYear}`;

  // Different years
  return `${startMonthName} ${startDay}, ${startYear} – ${endMonthName} ${endDay}, ${endYear}`;
}

/**
 * Normalizes a timestamp to Unix (milliseconds)
 * Accepts: Unix milliseconds (number), ISO 8601 string, or Date object
 */
function normalizeTimestamp(timestamp: number | string | Date): number {
  if (typeof timestamp === "number") return timestamp;
  if (typeof timestamp === "string") {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid ISO 8601 timestamp: ${timestamp}`);
    return date.getTime();
  }
  if (timestamp instanceof Date) return timestamp.getTime();
  throw new Error(`Invalid timestamp type: ${typeof timestamp}`);
}
