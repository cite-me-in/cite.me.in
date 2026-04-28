import { useState } from "react";
import ExpandableCheckCard from "~/components/ExpandableCheckCard";
import ImproveScoreModal from "~/components/ImproveScoreModal";
import RadialGauge from "~/components/RadialGauge";
import ShareButton from "~/components/ShareButton";
import { Badge } from "~/components/ui/Badge";
import {
  Card,
  CardContent,
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

  const totalPassed =
    (summary?.critical?.passed ?? 0) +
    (summary?.important?.passed ?? 0) +
    (summary?.optimization?.passed ?? 0);
  const totalChecks =
    (summary?.critical?.total ?? 0) +
    (summary?.important?.total ?? 0) +
    (summary?.optimization?.total ?? 0);
  const score = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 0;

  const failedChecks = checks.filter((c) => !c.passed);

  const groupedChecks = TIERS.map((tier) => ({
    ...tier,
    checks: checks.filter((c) => c.category === tier.key),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
        <RadialGauge score={score} />
        <div className="flex flex-wrap gap-3">
          {TIERS.map((tier) => {
            const s = summary[tier.key];
            const allPassed = s.passed === s.total;
            return (
              <a
                key={tier.key}
                href={`#section-${tier.key}`}
                className={`rounded-base border-2 px-5 py-3 text-left transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] ${
                  allPassed
                    ? "border-green-600 bg-green-50"
                    : "border-yellow-600 bg-yellow-50"
                }`}
              >
                <div className="text-lg font-bold">
                  {s.passed}/{s.total}
                </div>
                <div className="text-sm font-medium text-foreground/70">
                  {tier.key.charAt(0).toUpperCase() + tier.key.slice(1)}
                </div>
              </a>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {failedChecks.length > 0 && <ImproveScoreModal failedChecks={failedChecks} />}
        <ShareButton score={score} domain={domain} />
        {failedChecks.length === 0 && (
          <Badge variant="green" className="px-4 py-2 text-base">
            All checks passed!
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {groupedChecks.map((group) =>
          group.checks.length > 0 ? (
            <div key={group.key} id={`section-${group.key}`} className="space-y-2 scroll-mt-20">
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
