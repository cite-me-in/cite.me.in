import { ms } from "convert";
import { useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { useInterval } from "usehooks-ts";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SiteHeading";
import Spinner from "~/components/ui/Spinner";
import { getProgress } from "~/lib/aiLegibility/progress.server";
import type { ScanResult } from "~/lib/aiLegibility/types";
import { requireSiteAccess } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/site.$domain_.ai-legibility";

export const handle = { siteNav: true };

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `AI Legibility — ${params.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site, user } = await requireSiteAccess({
    domain: params.domain,
    request,
  });

  const report = await prisma.aiLegibilityReport.findFirst({
    where: { siteId: site.id, userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const progress = await getProgress({ offset: 0, domain: site.domain });
  const isRunning = !progress.done && progress.lines.length > 0;

  return {
    site,
    report: report
      ? {
          id: report.id,
          result: report.result as ScanResult,
          scannedAt: report.scannedAt.toISOString(),
        }
      : null,
    isRunning,
  };
}

export default function AiLegibilityPage({ loaderData }: Route.ComponentProps) {
  const { site, report, isRunning: initialRunning } = loaderData;
  const navigate = useNavigate();
  const fetcher = useFetcher<typeof loader>();

  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(initialRunning);
  const offsetRef = useRef(0);
  const logRef = useRef<HTMLPreElement>(null);

  const isRunning = fetcher.data?.isRunning ?? isScanning;

  useInterval(
    async () => {
      if (!isRunning) return;
      try {
        const res = await fetch(
          `/site/${site.domain}/ai-legibility/status?offset=${offsetRef.current}`,
        );
        const data = (await res.json()) as {
          lines: string[];
          done: boolean;
          nextOffset: number;
          result?: ScanResult;
        };
        if (data.lines.length > 0) {
          setLines((prev) => [...prev, ...data.lines]);
          offsetRef.current = data.nextOffset;
        }
        if (data.done && !done) {
          setDone(true);
          setLoading(true);
          setTimeout(() => navigate("."), 1000);
        }
      } catch {}
    },
    done || !isRunning ? null : ms("1s"),
  );

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  });

  const handleStartScan = () => {
    setIsScanning(true);
    setLines([]);
    setDone(false);
    setLoading(false);
    offsetRef.current = 0;
    fetcher.submit({}, { method: "POST", action: "scan" });
  };

  if (isRunning && !done) {
    return (
      <Main variant="wide">
        <SitePageHeader site={site} title="AI Legibility" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Spinner />
              Scanning…
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-foreground/60">
              Scanning: <code className="font-mono">{site.domain}</code>
            </p>
            <pre
              ref={logRef}
              className="h-96 overflow-y-auto whitespace-break-spaces rounded border border-border bg-muted p-4 font-mono text-foreground/60 text-sm leading-relaxed"
            >
              {lines.length === 0 && (
                <span className="text-foreground/40">Starting…</span>
              )}
              {lines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </pre>
          </CardContent>
        </Card>
      </Main>
    );
  }

  if (loading) {
    return (
      <Main variant="wide">
        <SitePageHeader site={site} title="AI Legibility" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Spinner />
              Loading results…
            </CardTitle>
          </CardHeader>
        </Card>
      </Main>
    );
  }

  if (report) {
    return (
      <Main variant="wide">
        <SitePageHeader site={site} title="AI Legibility" />
        <ScanResults
          result={report.result}
          scannedAt={report.scannedAt}
          onStartScan={handleStartScan}
        />
      </Main>
    );
  }

  return (
    <Main variant="wide">
      <SitePageHeader site={site} title="AI Legibility" />
      <Card variant="yellow">
        <CardHeader>
          <CardTitle>Check AI Readability</CardTitle>
          <CardDescription>
            Run a scan to check if your website is readable by AI agents like
            ChatGPT, Claude, and Gemini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleStartScan}>Run Scan</Button>
        </CardContent>
      </Card>
    </Main>
  );
}

function ScanResults({
  result,
  scannedAt,
  onStartScan,
}: {
  result: ScanResult;
  scannedAt: string;
  onStartScan: () => void;
}) {
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-foreground/60 text-sm">
            Last scanned: {new Date(scannedAt).toLocaleDateString()}
          </p>
        </div>
        <Button variant="outline" onClick={onStartScan}>
          Run New Scan
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overall Score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-3xl">{score}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Critical</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {summary?.critical?.passed ?? 0}/{summary?.critical?.total ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Important</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {summary?.important?.passed ?? 0}/{summary?.important?.total ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Optimization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {summary?.optimization?.passed ?? 0}/{summary?.optimization?.total ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Critical Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <CheckList checks={criticalChecks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Important Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <CheckList checks={importantChecks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Optimization Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <CheckList checks={optimizationChecks} />
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestions.map((suggestion, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="mb-2 flex items-start justify-between">
                  <h4 className="font-medium">{suggestion.title}</h4>
                  <div className="flex gap-2">
                    <Badge variant="neutral">{suggestion.effort}</Badge>
                    <Badge>{suggestion.category}</Badge>
                  </div>
                </div>
                <p className="text-foreground/60 text-sm">
                  {suggestion.description}
                </p>
                {suggestion.fixExample && (
                  <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
                    {suggestion.fixExample}
                  </pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CheckList({ checks }: { checks: ScanResult["checks"] }) {
  if (checks.length === 0) {
    return <p className="text-foreground/60">No checks in this category.</p>;
  }

  return (
    <div className="space-y-2">
      {checks.map((check, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className={check.passed ? "text-green-600" : "text-red-600"}>
            {check.passed ? "✓" : "✗"}
          </span>
          <div>
            <span className="font-medium">{check.name}</span>
            <p className="text-foreground/60 text-sm">{check.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
