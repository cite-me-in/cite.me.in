import { useRef } from "react";
import { twMerge } from "tailwind-merge";
import ShareButton from "~/components/ShareButton";
import { Badge } from "~/components/ui/Badge";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import CATEGORIES from "~/lib/aiLegibility/criteria";
import type { CheckResult, ScanResult } from "~/lib/aiLegibility/types";
import ImproveScoreModal from "~/routes/site.$domain_.ai-legibility/ImproveScoreModal";
import RadialGauge from "~/routes/site.$domain_.ai-legibility/RadialGauge";

export default function ScanSummary({
  checks,
  domain,
  summary,
}: {
  checks: CheckResult[];
  domain: string;
  summary: ScanResult["summary"];
}) {
  const scoreCardRef = useRef<HTMLDivElement>(null);

  const totalPassed =
    (summary?.discovered?.passed ?? 0) +
    (summary?.trusted?.passed ?? 0) +
    (summary?.welcomed?.passed ?? 0);
  const totalChecks =
    (summary?.discovered?.total ?? 0) +
    (summary?.trusted?.total ?? 0) +
    (summary?.welcomed?.total ?? 0);

  const failedChecks = checks.filter((c) => !c.passed);

  const handleCategoryClick = (key: string) => {
    const el = document.getElementById(`section-${key}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.focus({ preventScroll: true });
    }
  };

  return (
    <Card ref={scoreCardRef}>
      <CardHeader>
        <CardTitle>AI Legibility Score</CardTitle>
        <p className="text-foreground/60 text-center font-mono text-base">
          {domain}
        </p>
      </CardHeader>
      <CardContent className="mb-0 flex flex-col items-center gap-8">
        <RadialGauge summary={summary} />
        <div className="flex justify-center gap-6">
          {CATEGORIES.map((category) => {
            const checks = summary[category.key];
            return (
              checks && (
                <button
                  key={category.key}
                  onClick={() => handleCategoryClick(category.key)}
                  className="flex cursor-pointer flex-col items-center gap-1 transition-all hover:scale-105"
                >
                  <div
                    className={twMerge("text-base font-bold", category.color)}
                  >
                    {category.title}
                  </div>
                  <div className="text-foreground/50 text-xl">
                    {checks.passed}/{checks.total}
                  </div>
                </button>
              )
            );
          })}
        </div>
        <p className="text-foreground/50 min-w-xl text-center text-base">
          {totalPassed}/{totalChecks} checks passed
        </p>
      </CardContent>
      <CardFooter>
        <CardAction>
          {failedChecks.length === 0 ? (
            <Badge variant="green" className="px-4 py-2 text-base">
              All checks passed!
            </Badge>
          ) : (
            <ImproveScoreModal failedChecks={failedChecks} size="sm" />
          )}
        </CardAction>
        <CardAction>
          <ShareButton scoreCardRef={scoreCardRef} size="sm" />
        </CardAction>
      </CardFooter>
    </Card>
  );
}
