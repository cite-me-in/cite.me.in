import { Link, Text } from "react-email";
import Card from "~/components/email/Card";

export function BrandReminderCard({
  domain,
  citations,
}: {
  domain: string;
  citations: number;
}) {
  const n = citations.toLocaleString("en-US");
  const noun = citations === 1 ? "citation" : "citations";
  return (
    <Card withBorder>
      <Text className="text-base text-text leading-relaxed">
        <Link href="https://cite.me.in">cite.me.in</Link> is your window into
        how AI talks about your brand. Every day it asks ChatGPT, Claude,
        Gemini, and Perplexity the questions your customers ask — and records
        every time <strong>{domain}</strong> shows up. So far:{" "}
        <strong>
          {n} {noun}
        </strong>{" "}
        and counting.
      </Text>
    </Card>
  );
}

export function brandReminderText({
  domain,
  citations,
}: {
  domain: string;
  citations: number;
}): string {
  const n = citations.toLocaleString("en-US");
  const noun = citations === 1 ? "citation" : "citations";
  return (
    `A quick reminder of why you're here: cite.me.in tracks every time ` +
    `ChatGPT, Claude, Gemini, or Perplexity cites ${domain} in a real answer. ` +
    `You've collected ${n} ${noun} so far. That's the number you're here to grow.`
  );
}
