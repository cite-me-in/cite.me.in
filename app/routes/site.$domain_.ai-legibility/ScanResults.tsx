import { Badge } from "~/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import type { ScanResult } from "~/lib/aiLegibility/types";

export default function ScanResults({ result }: { result: ScanResult }) {
  const { summary, checks = [], suggestions = [] } = result || {};

  const criticalChecks = checks.filter((c) => c.category === "critical");
  const importantChecks = checks.filter((c) => c.category === "important");
  const optimizationChecks = checks.filter(
    (c) => c.category === "optimization",
  );

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
        <Figure title="Overall Score" score={score} />
        <Figure title="Critical" score={summary?.critical?.passed ?? 0} />
        <Figure title="Important" score={summary?.important?.passed ?? 0} />
        <Figure
          title="Optimization"
          score={summary?.optimization?.passed ?? 0}
        />
      </div>

      <CheckList
        title="Critical Checks"
        checks={criticalChecks}
        color="text-red-600"
      />
      <CheckList
        title="Important Checks"
        checks={importantChecks}
        color="text-yellow-600"
      />
      <CheckList
        title="Optimization Checks"
        checks={optimizationChecks}
        color="text-green-600"
      />

      {suggestions.length > 0 && (
        <Card>
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

function Figure({ title, score }: { title: string; score: number }) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="text-center">{title}</div>
        <div className="text-center font-bold text-3xl">{score}%</div>
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
        <h4 className="font-medium text-lg">{suggestion.title}</h4>
        <div className="flex gap-2">
          <Badge variant="neutral">{suggestion.effort}</Badge>
          <Badge>{suggestion.category}</Badge>
        </div>
      </div>
      <p className="text-base text-foreground/60">{suggestion.description}</p>
      {suggestion.fixExample && (
        <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 font-mono text-base">
          {suggestion.fixExample}
        </pre>
      )}
    </div>
  );
}
