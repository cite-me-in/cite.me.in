import { unique } from "radashi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import { normalizeDomain } from "~/lib/isSameDomain";

export default function RelatedCitations({
  relatedCitations,
}: {
  relatedCitations: {
    direct: { url: string; relationship: string; reason: string | null }[];
    indirect: { url: string; relationship: string; reason: string | null }[];
  };
}) {
  const { direct, indirect } = relatedCitations;

  const uniqueDirect = unique(direct, (c) => c.url);
  const uniqueIndirect = unique(indirect, (c) => c.url);

  const directCount = uniqueDirect.length;
  const indirectCount = uniqueIndirect.length;

  if (directCount === 0 && indirectCount === 0) return null;

  const totalScore = directCount + indirectCount * 0.5;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Related Citations</CardTitle>
        <CardDescription className="text-foreground/60">
          {directCount} direct ({directCount} pts) + {indirectCount} indirect (
          {indirectCount * 0.5} pts) = {totalScore} total
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {uniqueDirect.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium text-foreground text-sm">
                Direct Citations (1 pt each)
              </h4>
              <ul className="space-y-1">
                {uniqueDirect.map((citation) => (
                  <li
                    key={citation.url}
                    className="flex items-start gap-2 text-foreground/80 text-sm"
                  >
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {truncateUrl(citation.url)}
                    </a>
                    {citation.reason && (
                      <span className="text-foreground/50 text-xs">
                        ({citation.reason})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {uniqueIndirect.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium text-foreground text-sm">
                Indirect Citations (0.5 pts each)
              </h4>
              <ul className="space-y-1">
                {uniqueIndirect.map((citation) => (
                  <li
                    key={citation.url}
                    className="flex items-start gap-2 text-foreground/80 text-sm"
                  >
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {truncateUrl(citation.url)}
                    </a>
                    {citation.reason && (
                      <span className="text-foreground/50 text-xs">
                        ({citation.reason})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function truncateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const domain = normalizeDomain(parsed.hostname);
    const path =
      parsed.pathname.length > 30
        ? `${parsed.pathname.slice(0, 30)}…`
        : parsed.pathname;
    return `${domain}${path}`;
  } catch {
    return url.length > 50 ? `${url.slice(0, 50)}…` : url;
  }
}
