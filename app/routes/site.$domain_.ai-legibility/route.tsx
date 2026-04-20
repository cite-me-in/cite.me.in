import { RefreshCcwIcon } from "lucide-react";
import { useFetcher } from "react-router";
import { twMerge } from "tailwind-merge";
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
          result: JSON.parse(report.result as string) as ScanResult,
          scannedAt: report.scannedAt.toISOString(),
        }
      : null,
    isRunning,
    scannedAt: report?.scannedAt.toISOString(),
  };
}

export default function AiLegibilityPage({ loaderData }: Route.ComponentProps) {
  const { site, report, isRunning, scannedAt } = loaderData;
  const fetcher = useFetcher<typeof loader>();

  const isLoading = fetcher.state !== "idle" || isRunning;

  const handleStartScan = () => {
    fetcher.submit({}, { method: "POST", action: "scan" });
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
        <Button
          variant="outline"
          onClick={handleStartScan}
          disabled={isLoading}
        >
          <RefreshCcwIcon
            className={twMerge("size-4", isLoading && "animate-spin")}
          />
          Run New Scan
        </Button>
      </SitePageHeader>

      {isRunning}

      {isRunning ? (
        <Scanning domain={site.domain} />
      ) : report ? (
        <ScanResults result={report.result} />
      ) : (
        <Fallback handleStartScan={handleStartScan} />
      )}
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
