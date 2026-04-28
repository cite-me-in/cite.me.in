import { useRef } from "react";
import { twMerge } from "tailwind-merge";
import ImproveScoreModal from "~/components/ImproveScoreModal";
import RadialGauge from "~/components/RadialGauge";
import ShareButton from "~/components/ShareButton";
import { Badge } from "~/components/ui/Badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import TIERS from "~/lib/aiLegibility/criteria";
import type { CheckResult } from "~/lib/aiLegibility/types";

export default function ScanSummary({
  checks,
  domain,
  summary,
}: {
  checks: CheckResult[];
  domain: string;
  summary: {
    critical: { passed: number; total: number };
    important: { passed: number; total: number };
    optimization: { passed: number; total: number };
  };
}) {
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

  const handleTierClick = (key: string) => {
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
        <CardDescription className="text-foreground/60 text-center font-mono text-base">
          {domain}
        </CardDescription>
      </CardHeader>
      <CardContent className="mb-8 flex flex-row justify-center gap-8">
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
