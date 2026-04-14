import { useState } from "react";

export default function CitationGapAnalysis({
  gaps,
}: {
  gaps: {
    competitorDomain: string;
    queries: { id: string; query: string }[];
  }[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (gaps.length === 0) return null;

  return (
    <div className="border-2 border-black bg-white p-4 shadow-shadow">
      <h2 className="mb-1 font-bold text-lg">Citation Gaps</h2>
      <p className="mb-4 text-foreground/60 text-sm">
        Competitors cited where you are not
      </p>
      <div className="flex flex-col gap-2">
        {gaps.map(({ competitorDomain, queries }) => (
          <div key={competitorDomain} className="border-b pb-2 last:border-0">
            <button
              type="button"
              className="flex w-full items-center justify-between py-1 font-medium hover:text-foreground/70"
              onClick={() =>
                setExpanded(
                  expanded === competitorDomain ? null : competitorDomain,
                )
              }
            >
              <span>{competitorDomain}</span>
              <span className="text-foreground/60 text-sm">
                {queries.length} {queries.length === 1 ? "query" : "queries"}
              </span>
            </button>
            {expanded === competitorDomain && (
              <ul className="mt-1 ml-4 flex flex-col gap-1">
                {queries.map((q) => (
                  <li key={q.id} className="text-foreground/60 text-sm">
                    — {q.query}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
