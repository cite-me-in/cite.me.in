import ExpandableCheckCard from "~/components/ExpandableCheckCard";
import TIERS from "~/lib/aiLegibility/criteria";
import type { CheckResult } from "~/lib/aiLegibility/types";

export default function ScanResults({ checks }: { checks: CheckResult[] }) {
  const groupedChecks = TIERS.map((tier) => ({
    ...tier,
    checks: checks.filter((c) => c.category === tier.key),
  }));

  return (
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
  );
}
