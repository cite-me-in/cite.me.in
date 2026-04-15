import { Badge } from "~/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import { normalizeDomain } from "~/lib/isSameDomain";

export const INDIRECT_CITATION_WEIGHT = 0.5;

export default function RelatedCitations({
  relatedCitations,
}: {
  relatedCitations: {
    exact: string[];
    direct: { url: string; reason: string | null }[];
    indirect: { url: string; reason: string | null }[];
  };
}) {
  const { exact, direct, indirect } = relatedCitations;

  const directCount = exact.length + direct.length;
  const indirectCount = indirect.length;

  if (directCount === 0 && indirectCount === 0) return null;

  const totalScore = directCount + indirectCount * INDIRECT_CITATION_WEIGHT;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Related Citations</CardTitle>
        <CardDescription className="text-foreground/60">
          {directCount} direct + {indirectCount} indirect (×0.5) = {totalScore}{" "}
          total
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {directCount > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-2 font-medium text-foreground text-sm">
                Direct Citations
                <Badge variant="green">1 pt each</Badge>
              </h4>
              <ul className="space-y-1">
                {exact.map((url) => (
                  <li key={url} className="flex items-start gap-2 text-sm">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {truncateUrl(url)}
                    </a>
                  </li>
                ))}
                {direct.map((citation) => (
                  <li
                    key={citation.url}
                    className="flex items-start gap-2 text-sm"
                  >
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-teal-700 hover:underline dark:text-teal-400"
                    >
                      {truncateUrl(citation.url)}
                    </a>
                    {citation.reason && (
                      <span className="text-foreground/50 text-xs">
                        {citation.reason}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {indirect.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-2 font-medium text-foreground text-sm">
                Indirect Citations
                <Badge variant="neutral">0.5 pts each</Badge>
              </h4>
              <ul className="space-y-1">
                {indirect.map((citation) => (
                  <li
                    key={citation.url}
                    className="flex items-start gap-2 text-sm"
                  >
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {truncateUrl(citation.url)}
                    </a>
                    {citation.reason && (
                      <span className="text-foreground/50 text-xs">
                        {citation.reason}
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
