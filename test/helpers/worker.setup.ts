import { Temporal } from "@js-temporal/polyfill";
import "~/test/mocks/msw";

export const fixedTime = new Date("2023-11-14T22:13:20.000Z");

/**
 * Use this in entry.server.tsx to patch global Date to always return a fixed
 * date/time. Make sure only used in test mode.
 */
export default function setupTestServer() {
  if (process.env.NODE_ENV !== "test") return;

  // Patch global Date to always return a fixed date/time
  const RealDate = Date;
  // @ts-expect-error
  global.Date = class extends RealDate {
    constructor(...args: Parameters<typeof Date>) {
      if (args.length === 0) super(fixedTime.getTime());
      else super(...args);
    }
    static now = () => fixedTime.getTime();
    static parse = RealDate.parse;
    static UTC = RealDate.UTC;
    static toString = RealDate.toString;
    static [Symbol.species] = RealDate;
  };

  // Patch temporal methods to return a fixed date/time
  const epochMilliseconds = BigInt(fixedTime.getTime() * 1_000_000);
  Temporal.Now.instant = () => new Temporal.Instant(epochMilliseconds);
  Temporal.Now.zonedDateTimeISO = (timeZone) =>
    new Temporal.ZonedDateTime(
      epochMilliseconds,
      timeZone?.toString() ?? "UTC",
    );
  Temporal.Now.plainDateISO = () =>
    new Temporal.PlainDate(
      fixedTime.getFullYear(),
      fixedTime.getMonth() + 1,
      fixedTime.getDate(),
    );
}
