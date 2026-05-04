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
    {
      status: "pending" | "running" | "passed" | "failed";
      message?: string;
      current?: number;
      total?: number;
    }
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
          return (
            <CheckStatus
              key={name}
              name={name}
              status={state?.status || "pending"}
            >
              {state?.status === "running" ? (
                state.current !== undefined && state.total !== undefined ? (
                  <span className="ml-auto text-xs text-amber-600">
                    {state.current}/{state.total} pages
                  </span>
                ) : (
                  <span className="ml-auto animate-pulse text-xs text-amber-600">
                    Checking...
                  </span>
                )
              ) : (
                state?.message ||
                (state?.status === "passed" ? "Passed" : "Failed")
              )}
            </CheckStatus>
          );
        })}
      </div>
    </div>
  );
}

function CheckStatus({
  name,
  status,
  children,
}: {
  name: string;
  status: "pending" | "running" | "passed" | "failed";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-base flex items-start gap-3 border-2 p-3 text-base shadow-[2px_2px_0px_0px_black] ${
        status === "pending"
          ? "border-black/20 bg-white p-3 text-base shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]"
          : status === "running"
            ? "border-amber-500 bg-amber-50 shadow-[2px_2px_0px_0px_#D97706]"
            : status === "passed"
              ? "border-green-600 bg-green-50"
              : "border-red-600 bg-red-50"
      }`}
    >
      <div className="pt-1">
        {status === "pending" ? (
          <span className="h-4 w-4 shrink-0 rounded-full border-2 border-black/20" />
        ) : status === "running" ? (
          <div className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        ) : status === "passed" ? (
          <CheckCircleIcon className="h-4 w-4 shrink-0 text-green-600" />
        ) : (
          <XCircleIcon className="h-4 w-4 shrink-0 text-red-600" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div
          className={`text-base font-bold ${
            status === "pending"
              ? "text-black/40"
              : status === "running"
                ? "text-amber-800"
                : status === "passed"
                  ? "text-green-800"
                  : "text-red-800"
          }`}
        >
          {name}
        </div>
        <div
          className={`ml-auto text-sm ${
            status === "running"
              ? "text-amber-600"
              : status === "passed"
                ? "text-green-600"
                : "text-red-600"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
