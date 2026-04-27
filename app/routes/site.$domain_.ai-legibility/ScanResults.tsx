import { Badge } from "~/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import TIERS from "~/lib/aiLegibility/criteria";
import type { ScanResult } from "~/lib/aiLegibility/types";

export default function ScanResults({ result }: { result: ScanResult }) {
  const { summary, checks, suggestions } = result || {};

  const groupChecks = (key: string) => checks.filter((c) => c.category === key);

  const totalPassed =
    (summary?.critical?.passed ?? 0) +
    (summary?.important?.passed ?? 0) +
    (summary?.optimization?.passed ?? 0);
  const totalChecks =
    (summary?.critical?.total ?? 0) +
    (summary?.important?.total ?? 0) +
    (summary?.optimization?.total ?? 0);
  const score =
    totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Figure title="Overall Score" value={`${score}%`} />
        {TIERS.map((tier) => (
          <Figure
            key={tier.key}
            title={tier.title.split(" — ")[0]}
            value={`${summary?.[tier.key]?.passed ?? 0}/${summary?.[tier.key]?.total ?? 0}`}
          />
        ))}
      </div>

      {TIERS.map((tier) => (
        <CheckList
          key={tier.key}
          title={`${tier.title.split(" — ")[0]} Checks`}
          checks={groupChecks(tier.key)}
          color={tier.color}
        />
      ))}

      {suggestions.length > 0 && (
        <Card id="suggestions">
          <CardHeader>
            <CardTitle>Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestions.map((suggestion, i) => (
              <SuggestionItem key={i.toString()} suggestion={suggestion} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Figure({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="text-center">{title}</div>
        <div className="text-center text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function CheckList({
  title,
  checks,
  color,
}: {
  title: string;
  checks: ScanResult["checks"];
  color: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={color}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {checks.length === 0 ? (
          <p className="text-foreground/60">No checks in this category.</p>
        ) : (
          <div className="space-y-2">
            {checks.map((check, i) => (
              <div key={i.toString()} className="flex items-start gap-2">
                <span
                  className={check.passed ? "text-green-600" : "text-red-600"}
                >
                  {check.passed ? "✓" : "✗"}
                </span>
                <div>
                  <span className="font-medium">{check.name}</span>
                  <p className="text-foreground/60 text-sm">{check.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SuggestionItem({
  suggestion,
}: {
  suggestion: ScanResult["suggestions"][0];
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-start justify-between">
        <h4 className="text-lg font-medium">{suggestion.title}</h4>
        <div className="flex gap-2">
          <Badge variant="neutral">{suggestion.effort}</Badge>
          <Badge>{suggestion.category}</Badge>
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
