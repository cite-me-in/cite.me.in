import { Column, Row, Section, Text } from "@react-email/components";
import { twMerge } from "tailwind-merge";

export default function KeyMetric({
  label,
  isLast,
  current,
  previous,
}: {
  label: string;
  isLast: boolean;
  current: number | string;
  previous?: number;
}) {
  return (
    <Column className={twMerge(isLast ? "" : "pr-2", "w-1/4")}>
      <Section className="w-full overflow-hidden rounded-lg border border-border bg-white">
        <Row>
          <Column className="bg-gray-100 px-4 text-center">
            <Text className="mb-1.5 whitespace-nowrap text-light text-xs uppercase tracking-wide">
              {label}
            </Text>
            <Text className="font-bold text-2xl text-dark tabular-nums">
              {current.toLocaleString()}
            </Text>

            {typeof current === "number" &&
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
