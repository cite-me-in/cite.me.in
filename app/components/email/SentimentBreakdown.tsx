import { Column, Row, Section, Text } from "@react-email/components";
import { sort } from "radashi";
import { twMerge } from "tailwind-merge";
import PLATFORMS from "~/lib/llm-visibility/platforms";
import type { SentimentLabel } from "~/prisma";
import Card from "./Card";

export default function SentimentBreakdown({
  byPlatform,
}: {
  byPlatform: Record<
    string,
    { sentimentLabel: SentimentLabel | null; sentimentSummary: string | null }
  >;
}) {
  const platforms = sort(
    Object.entries(byPlatform).filter(
      ([, { sentimentLabel, sentimentSummary }]) =>
        sentimentLabel && sentimentSummary,
    ),
    ([, { sentimentLabel }]) =>
      ["positive", "mixed", "negative", "neutral"].indexOf(
        sentimentLabel ?? "neutral",
      ),
  );
  if (platforms.length === 0) return null;

  const sentimentColors: Record<SentimentLabel, string> = {
    positive: "text-green-500",
    negative: "text-red-500",
    neutral: "text-gray-500",
    mixed: "text-yellow-500",
  };

  return (
    <Card title="AI sentiment" withBorder>
      {platforms.map(([platform, { sentimentLabel, sentimentSummary }]) => (
        <Section key={platform} className="border-border border-b py-3">
          <Row>
            <Column className="w-1/2">
              {PLATFORMS.find((p) => p.name === platform)?.label ?? platform}
            </Column>
            <Column className="w-1/2 text-right">
              <Text
                className={twMerge(
                  "text-right text-sm uppercase",
                  sentimentColors[sentimentLabel ?? "neutral"],
                )}
              >
                {sentimentLabel ?? "neutral"}
              </Text>
            </Column>
          </Row>
          <Row>
            <Text className="text-light text-sm leading-6">
              {sentimentSummary ?? "No sentiment analysis available."}
            </Text>
          </Row>
        </Section>
      ))}
    </Card>
  );
}
