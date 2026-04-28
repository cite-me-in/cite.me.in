import { useRef } from "react";
import { twMerge } from "tailwind-merge";
import ExpandableCheckCard from "~/components/ExpandableCheckCard";
import ImproveScoreModal from "~/components/ImproveScoreModal";
import RadialGauge from "~/components/RadialGauge";
import ShareButton from "~/components/ShareButton";
import { Badge } from "~/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import TIERS from "~/lib/aiLegibility/criteria";
import type { ScanResult } from "~/lib/aiLegibility/types";

export default function ScanResults({
  result,
  domain,
}: {
  result: ScanResult;
  domain: string;
}) {
  const { summary, checks, suggestions } = result;
  const scoreCardRef = useRef<HTMLDivElement>(null);

  const totalPassed =
    (summary?.critical?.passed ?? 0) +
    (summary?.important?.passed ?? 0) +
    (summary?.optimization?.passed ?? 0);
  const totalChecks =
    (summary?.critical?.total ?? 0) +
    (summary?.important?.total ?? 0) +
    (summary?.optimization?.total ?? 0);

  const failedChecks = checks.filter((c) => !c.passed);

  const groupedChecks = TIERS.map((tier) => ({
    ...tier,
    checks: checks.filter((c) => c.category === tier.key),
  }));

  const handleTierClick = (key: string) => {
    const el = document.getElementById(`section-${key}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.focus({ preventScroll: true });
    }
  };

  return (
    <div className="space-y-6">
      <Card ref={scoreCardRef}>
        <CardHeader>
          <CardTitle>AI Legibility Score</CardTitle>
          <CardDescription className="text-foreground/60 text-center font-mono text-base">
            {domain}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-8">
            <div className="grid grid-cols-2 gap-8">
              <RadialGauge passed={totalPassed} total={totalChecks} />

              <div
                className={twMerge(
                  "grid justify-center gap-6 pt-12",
                  `grid-cols-${TIERS.length}`,
                )}
              >
                {TIERS.map((tier) => {
                  const s = summary[tier.key];
                  const pct =
                    s.total > 0 ? Math.round((s.passed / s.total) * 100) : 0;
                  const colorClass =
                    pct >= 80
                      ? "border-green-500 text-green-600"
                      : pct >= 50
                        ? "border-yellow-500 text-yellow-600"
                        : "border-orange-500 text-orange-600";
                  return (
                    <button
                      key={tier.key}
                      onClick={() => handleTierClick(tier.key)}
                      className="flex cursor-pointer flex-col items-center gap-2 transition-all hover:scale-105"
                    >
                      <div
                        className={`flex size-14 items-center justify-center rounded-full border-2 text-xl font-bold ${colorClass}`}
                      >
                        {pct}
                      </div>
                      <span className="text-foreground/70 text-xs font-semibold tracking-wide uppercase">
                        {tier.key}
                      </span>
                      <span className="text-foreground/50 text-xs">
                        {s.passed}/{s.total}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {failedChecks.length > 0 && (
              <ImproveScoreModal failedChecks={failedChecks} />
            )}
            {failedChecks.length === 0 && (
              <Badge variant="green" className="px-4 py-2 text-base">
                All checks passed!
              </Badge>
            )}
          </div>
          <ShareButton scoreCardRef={scoreCardRef} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {groupedChecks.map((group) =>
          group.checks.length > 0 ? (
            <div
              key={group.key}
              id={`section-${group.key}`}
              className="scroll-mt-20 space-y-2"
            >
              <h3 className={`text-lg font-bold ${group.color}`}>
                {group.title.split(" — ")[0]}
              </h3>
              {group.checks.map((check, i) => (
                <ExpandableCheckCard key={i} check={check} />
              ))}
            </div>
          ) : null,
        )}
      </div>

      {suggestions.length > 0 && (
        <Card id="suggestions">
          <CardHeader>
            <CardTitle>Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestions.map((suggestion, i) => (
              <SuggestionItem key={i} suggestion={suggestion} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SuggestionItem({
  suggestion,
}: {
  suggestion: ScanResult["suggestions"][0];
}) {
  const colorMap: Record<string, "red" | "yellow" | "green"> = {
    critical: "red",
    important: "yellow",
    optimization: "green",
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-start justify-between">
        <h4 className="text-lg font-medium">{suggestion.title}</h4>
        <div className="flex gap-2">
          <Badge variant="neutral">{suggestion.effort}</Badge>
          <Badge variant={colorMap[suggestion.category] ?? "neutral"}>
            {suggestion.category}
          </Badge>
        </div>
      </div>
      <p className="text-foreground/60 text-base">{suggestion.description}</p>
      {suggestion.fixExample && (
        <pre className="bg-muted mt-2 overflow-x-auto rounded p-2 font-mono text-base">
          {suggestion.fixExample}
        </pre>
      )}
    </div>
  );
}
