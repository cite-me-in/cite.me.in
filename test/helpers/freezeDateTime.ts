import { Temporal } from "@js-temporal/polyfill";
import invariant from "tiny-invariant";
import "~/test/mocks/msw";

export const fixedTime = new Date("2023-11-14T22:13:20.000Z");

/**
 * Use this in serverWorker.ts to patch global Date to always return a fixed
 * date/time. Also applies to Temporary. Make sure only used in test mode.
 */
invariant(
  process.env.NODE_ENV === "test",
  "freezeDateTime should only be used in test mode",
);

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
  new Temporal.ZonedDateTime(epochMilliseconds, timeZone?.toString() ?? "UTC");
Temporal.Now.plainDateISO = () =>
  new Temporal.PlainDate(
    fixedTime.getFullYear(),
    fixedTime.getMonth() + 1,
    fixedTime.getDate(),
  );
