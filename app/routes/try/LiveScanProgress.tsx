import { CheckCircleIcon, XCircleIcon } from "lucide-react";
import { twMerge } from "tailwind-merge";
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
          const state = checkStates[name] ?? { status: "pending" };
          return (
            <CheckStatus
              key={name}
              name={name}
              status={state.status || "pending"}
            >
              {state.status === "passed"
                ? state.message || "Passed"
                : state.status === "failed"
                  ? state.message || "Failed"
                  : state.status === "running"
                    ? state.current !== undefined && state.total !== undefined
                      ? `${state.current}/${state.total} pages`
                      : "Checking..."
                    : "Pending"}
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
      className={twMerge(
        `rounded-base shadow-[2px_2px_0px_0px_black flex items-start gap-3 border-2 p-3 text-base`,
        {
          passed: "border-green-600 bg-green-50",
          failed: "border-red-600 bg-red-50",
          running:
            "border-amber-500 bg-amber-50 shadow-[2px_2px_0px_0px_#D97706]",
          pending:
            "border-black/20 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]",
        }[status] ||
          "border-black/20 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]",
      )}
    >
      <div className="pt-1">
        {status === "passed" ? (
          <CheckCircleIcon className="size-4 shrink-0 text-green-600" />
        ) : status === "failed" ? (
          <XCircleIcon className="size-4 shrink-0 text-red-600" />
        ) : status === "running" ? (
          <div className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        ) : (
          <span className="size-4 shrink-0 rounded-full border-2 border-black/20" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div
          className={twMerge(
            "text-base font-bold",
            {
              passed: "text-green-800",
              failed: "text-red-800",
              running: "text-amber-800",
              pending: "text-black/40",
            }[status] || "text-black/40",
          )}
        >
          {name}
        </div>
        <div
          className={twMerge(
            "ml-auto text-sm",
            {
              passed: "text-green-600",
              failed: "text-red-600",
              running: "text-amber-600",
              pending: "text-black/40",
            }[status] || "text-black/40",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
