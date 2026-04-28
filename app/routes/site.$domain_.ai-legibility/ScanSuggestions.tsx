import { Badge } from "~/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import type { Suggestion } from "~/lib/aiLegibility/types";

export default function ScanSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  return (
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
  );
}

function SuggestionItem({ suggestion }: { suggestion: Suggestion }) {
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
