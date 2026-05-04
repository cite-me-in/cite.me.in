import { CheckCircleIcon, XCircleIcon } from "lucide-react";
import { Card, CardHeader, CardTitle } from "~/components/ui/Card";

export const LOG_TO_CHECK: Record<string, string> = {
  "page content": "Page content",
  "robots.txt": "robots.txt",
  "sitemap.xml": "sitemap.xml",
  "sitemap.txt": "sitemap.txt",
  "sample pages": "Sample pages",
  "JSON-LD": "JSON-LD",
  "meta tags": "Meta tags",
  "llms.txt": "llms.txt",
  "sitemap link headers": "Sitemap link headers",
  "markdown alternate links": "Markdown alternate links",
  ".md routes": ".md routes",
  "robots directives (noindex)": "Robots directives",
  "markdown content negotiation": "Markdown content negotiation",
  "Content-Signal in robots.txt": "Content Signals",
  "llms-full.txt": "llms-full.txt",
};

export default function LiveScanProgress({
  checkStates,
  lines,
}: {
  checkStates: Record<
    string,
    { status: string; message?: string; current?: number; total?: number }
  >;
  lines: string[];
}) {
  return (
    <div className="space-y-4">
      {lines.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
              Starting scan...
            </CardTitle>
          </CardHeader>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.values(LOG_TO_CHECK).map((name) => {
          const state = checkStates[name];
          if (!state || state.status === "pending") {
            return (
              <div
                key={name}
                className="rounded-base flex items-center gap-3 border-2 border-black/20 bg-white p-3 text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]"
              >
                <div className="h-4 w-4 shrink-0 rounded-full border-2 border-black/20" />
                <span className="text-black/40">{name}</span>
              </div>
            );
          }
          if (state.status === "running") {
            return (
              <div
                key={name}
                className="rounded-base flex items-center gap-3 border-2 border-amber-500 bg-amber-50 p-3 text-sm shadow-[2px_2px_0px_0px_#D97706]"
              >
                <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                <span className="font-bold text-amber-800">{name}</span>
                {state.current !== undefined && state.total !== undefined ? (
                  <span className="ml-auto text-xs text-amber-600">
                    {state.current}/{state.total} pages
                  </span>
                ) : (
                  <span className="ml-auto animate-pulse text-xs text-amber-600">
                    Checking...
                  </span>
                )}
              </div>
            );
          }
          const isPassed = state.status === "passed";
          return (
            <div
              key={name}
              className={`rounded-base flex items-center gap-3 border-2 p-3 text-sm shadow-[2px_2px_0px_0px_black] ${
                isPassed
                  ? "border-green-600 bg-green-50"
                  : "border-red-600 bg-red-50"
              }`}
            >
              {isPassed ? (
                <CheckCircleIcon className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <XCircleIcon className="h-4 w-4 shrink-0 text-red-600" />
              )}
              <span
                className={`font-bold ${isPassed ? "text-green-800" : "text-red-800"}`}
              >
                {name}
              </span>
              <span
                className={`ml-auto text-xs ${isPassed ? "text-green-600" : "text-red-600"}`}
              >
                {state.message || (isPassed ? "Passed" : "Failed")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
