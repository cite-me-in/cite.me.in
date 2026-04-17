import { Column, Row, Section, Text } from "react-email";
import { twMerge } from "tailwind-merge";

type KeyMetric =
  | {
      label: string;
      current: number | string;
      highlightScore?: boolean;
    }
  | {
      label: string;
      current: number;
      previous: number;
      highlightScore?: boolean;
    }
  | {
      label: string;
      current: string;
      previous: never;
      highlightScore?: boolean;
    };

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
export default function KeyMetrics({ metrics }: { metrics: KeyMetric[] }) {
  const width = `w-1/${metrics.length}`;
  return (
    <Row>
      {metrics.map((metric, i) => (
        <Column
          key={i.toString()}
          className={twMerge(i === metrics.length - 1 ? "" : "pr-2", width)}
        >
          <Section className="w-full overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50">
            <Row>
              <Column className="px-4 text-center">
                <Text className="mb-1.5 whitespace-nowrap text-light text-xs uppercase tracking-wide">
                  {metric.label}
                </Text>
                <Text
                  className={twMerge(
                    "font-bold text-2xl tabular-nums",
                    metric.highlightScore
                      ? getScoreColor(Number(metric.current))
                      : "text-dark",
                  )}
                >
                  {metric.current.toLocaleString()}
                </Text>

                {"count" in metric ? (
                  <Text className="text-light text-xs">
                    {(metric.count as number).toLocaleString()}
                  </Text>
                ) : "previous" in metric ? (
                  <Text className="flex items-center justify-center gap-1">
                    <span
                      className={twMerge(
                        "text-center font-semibold text-sm",
                        pctDeltaColor(
                          metric.current as number,
                          metric.previous,
                        ),
                      )}
                    >
                      {pctDelta(metric.current as number, metric.previous)}
                    </span>
                    <span className="text-light text-xs">
                      {metric.previous.toLocaleString()}
                    </span>
                  </Text>
                ) : null}
              </Column>
            </Row>
          </Section>
        </Column>
      ))}
    </Row>
  );
}

function pctDelta(current: number | string, previous: number): string {
  const float = Number.parseFloat(current as string);
  if (previous === 0) return float === 0 ? "—" : "+∞%";
  const pct = Math.round(((float - previous) / previous) * 100);
  if (pct === 0) return "—";
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function pctDeltaColor(current: number, previous: number): string {
  if (current > previous) return "text-green-500";
  if (current < previous) return "text-red-500";
  return "text-gray-500";
}

function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 30) return "text-gray-600";
  return "text-red-600";
}
