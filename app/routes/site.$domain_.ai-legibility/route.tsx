import { RefreshCcwIcon } from "lucide-react";
import { useState } from "react";
import { twMerge } from "tailwind-merge";
import AiLegibilityCriteria from "~/components/AiLegibilityCriteria";
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
import { getProgress } from "~/lib/aiLegibility/progress.server";
import type { ScanResult } from "~/lib/aiLegibility/types";
import { requireSiteAccess } from "~/lib/auth.server";
import { formatDateMed } from "~/lib/formatDate";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";
import Scanning from "./Scanning";
import ScanResults from "./ScanResults";
import ScanSuggestions from "./ScanSuggestions";
import ScanSummary from "./ScanSummary";

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
  const isRunning = progress && !progress.done;

  return {
    site,
    report: report
      ? {
          id: report.id,
          result:
            typeof report.result === "string"
              ? (JSON.parse(report.result) as ScanResult)
              : (report.result as ScanResult),
          scannedAt: report.scannedAt.toISOString(),
        }
      : null,
    isRunning,
    scannedAt: report?.scannedAt.toISOString(),
  };
}

export default function AiLegibilityPage({ loaderData }: Route.ComponentProps) {
  const { site, report, isRunning, scannedAt } = loaderData;
  const [isLoading, setIsLoading] = useState(false);

  const startScan = () => {
    void fetch(`/site/${site.domain}/ai-legibility/scan`, {
      method: "POST",
    }).finally(() => setIsLoading(false));
    setIsLoading(true);
  };

  return (
    <Main variant="wide">
      <SitePageHeader
        site={site}
        title="AI Legibility"
        subtitle={
          scannedAt && `Last scanned: ${formatDateMed(new Date(scannedAt))}`
        }
      >
        <Button variant="outline" onClick={startScan} disabled={isLoading}>
          <RefreshCcwIcon
            className={twMerge("size-4", isLoading && "animate-spin")}
          />
          Run New Scan
        </Button>
      </SitePageHeader>

      {isRunning || isLoading ? (
        <Scanning domain={site.domain} />
      ) : report ? (
        <>
          <ScanSummary
            checks={report.result.checks}
            summary={report.result.summary}
            domain={site.domain}
          />
          <ScanResults checks={report.result.checks} />
          {report.result.suggestions.length > 0 && (
            <ScanSuggestions suggestions={report.result.suggestions} />
          )}
        </>
      ) : (
        <Fallback handleStartScan={startScan} />
      )}

      <AiLegibilityCriteria />
    </Main>
  );
}

function Fallback({ handleStartScan }: { handleStartScan: () => void }) {
  return (
    <Card variant="yellow">
      <CardHeader>
        <CardTitle>Check AI Readability</CardTitle>
        <CardDescription className="text-center">
          Run a scan to check if your website is readable by AI agents like
          ChatGPT, Claude, and Gemini.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button onClick={handleStartScan}>Run Scan</Button>
      </CardContent>
    </Card>
  );
}
