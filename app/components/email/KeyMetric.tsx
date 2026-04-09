import { Column, Row, Section, Text } from "@react-email/components";
import { twMerge } from "tailwind-merge";

/**
 * Renders a row of key metrics. Each metric is displayed in a column with a
 * width of 1/N, where N is the number of metrics. The metric must have a label
 * and a current value, which is shown in a large font size. The metric may also
 * have a previous value, in which case it will show the difference from the
 * previous value, or a count which will show under the current value.
 *
 * @param metrics - The metrics to display.
 * @returns A row of key metrics.
 */
export default function KeyMetrics({
  metrics,
}: {
  metrics: {
    label: string;
    current: number | string;
    previous?: number;
    count?: number;
  }[];
}) {
  const width = `w-1/${metrics.length}`;
  return (
    <Row>
      {metrics.map((metric, i) => (
        <KeyMetric
          className={twMerge(i === metrics.length - 1 ? "" : "pr-2", width)}
          count={metric.count}
          current={metric.current}
          key={metric.label}
          label={metric.label}
          previous={metric.previous}
        />
      ))}
    </Row>
  );
}

function KeyMetric({
  className,
  current,
  label,
  previous,
  count,
}: {
  className: string;
  current: number | string;
  label: string;
  previous?: number;
  count?: number;
}) {
  return (
    <Column className={twMerge(className)}>
      <Section className="w-full overflow-hidden rounded-lg border border-border bg-white">
        <Row>
          <Column className="bg-gray-100 px-4 text-center">
            <Text className="mb-1.5 whitespace-nowrap text-light text-xs uppercase tracking-wide">
              {label}
            </Text>
            <Text className="font-bold text-2xl text-dark tabular-nums">
              {current.toLocaleString()}
            </Text>

            {count != null ? (
              <Text className="text-light text-xs">
                {count.toLocaleString()}
              </Text>
            ) : typeof current === "number" &&
              previous != null &&
              previous !== 0 ? (
              <Text className="flex items-center justify-center gap-1">
                <span
                  className={twMerge(
                    "text-center font-semibold text-sm",
                    pctDeltaColor(current, previous),
                  )}
                >
                  {pctDelta(current, previous)}
                </span>
                <span className="text-light text-xs">
                  {previous.toLocaleString()}
                </span>
              </Text>
            ) : null}
          </Column>
        </Row>
      </Section>
    </Column>
  );
}

function pctDelta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "—" : "+∞%";
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "—";
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function pctDeltaColor(current: number, previous: number): string {
  if (current > previous) return "text-green-500";
  if (current < previous) return "text-red-500";
  return "text-gray-500";
}
