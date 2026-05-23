import { Temporal } from "@js-temporal/polyfill";
import { useSearchParams } from "react-router";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/Tabs";

/**
 * These are the time periods user can tab through.
 */
const periods = [14, 30, 90];

/**
 * A hook that returns the start and end dates and a function to set the range.
 * The start and end dates are parsed from the search params. The function to
 * set the range is used to update the search params and can be used with
 * useTransition in client. Can be used with useSearchParams in client,
 * URLSearchParams in server.
 *
 * @example
 * const { from, until, period, today, setRange } = useRangeSelection();
 * setRange(today.subtract({ days: 14 }), today);
 *
 * @returns The start and end dates and a function to set the range and the today's date.
 */
export function useRangeSelection(): {
  from: Temporal.PlainDate;
  period: number;
  setRange: (from: Temporal.PlainDate, until: Temporal.PlainDate) => void;
  today: Temporal.PlainDate;
  until: Temporal.PlainDate;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const { from, period, until, today } = parseDateRange(searchParams);
  const setRange = (from: Temporal.PlainDate, until: Temporal.PlainDate) => {
    setSearchParams(
      (params) => {
        params.set("from", from.toString());
        params.set("until", until.toString());
        return params;
      },
      { replace: true, viewTransition: true },
    );
  };
  return { from, until, period, today, setRange };
}

/**
 * Parses the start and end dates and the today's date from the search params.
 * Can be used with URLSearchParams in server.
 *
 * @example
 * const { from, until, today } = parseDateRange(new URL(request.url).searchParams);
 * @param searchParams - The search params to parse the dates from.
 * @returns The start and end dates and the today's date.
 */
export function parseDateRange(searchParams: URLSearchParams): {
  from: Temporal.PlainDate;
  period: number;
  until: Temporal.PlainDate;
  today: Temporal.PlainDate;
} {
  const today = Temporal.Now.plainDateISO("UTC");

  let until: Temporal.PlainDate;
  try {
    until = Temporal.PlainDate.from(searchParams.get("until") ?? "");
  } catch {
    until = today;
  }

  let from: Temporal.PlainDate;
  try {
    from = Temporal.PlainDate.from(searchParams.get("from") ?? "");
  } catch {
    from = today.subtract({ days: periods[1] });
  }

  const todayDate = today.toString();
  const untilDate = until.toString();
  const period =
    untilDate === todayDate
      ? Math.floor(
          from
            .until(until, { largestUnit: "day", smallestUnit: "day" })
            .total("hours") / 24,
        )
      : periods[1];

  return { from, period, today, until };
}

/**
 * A component that allows the user to select a range of dates. Can be used with
 * useRangeSelection in client, URLSearchParams in server.
 *
 * @returns The component that allows the user to select a range of dates.
 */
export default function DateRangeSelector() {
  const { period, today, setRange } = useRangeSelection();
  return (
    <Tabs
      value={period}
      onValueChange={(value) => {
        setRange(today.subtract({ days: Number(value) }), today);
      }}
    >
      <TabsList>
        {periods.map((daysInPeriod) => (
          <TabsTrigger
            key={daysInPeriod}
            value={daysInPeriod}
            title={`Select the last ${daysInPeriod} days`}
          >
            Last {daysInPeriod} Days
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
