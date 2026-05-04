import { CheckIcon, GlobeIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Form, redirect, useActionData } from "react-router";
import { useInterval } from "usehooks-ts";
import LandingPageNav from "~/components/layout/LandingPageNav";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import type { ScanResult } from "~/lib/aiLegibility/types";
import { requireUserAccess } from "~/lib/auth.server";
import { extractDomain } from "~/lib/sites.server";
import { getScanStatus } from "~/lib/tryScan.server";
import type { Route } from "./+types/route";
import BenefitsSection from "./BenefitsSection";
import LiveScanProgress, { LOG_TO_CHECK } from "./LiveScanProgress";
import ScanResults from "./ScanResults";
import SignUpSection from "./SignUpSection";

export const handle = { hideHeader: true };

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain") ?? "";
  const user = await requireUserAccess(request).catch(() => null);

  let scanStatus = null;
  if (domain) {
    const d = extractDomain(domain);
    if (d) scanStatus = await getScanStatus(d);
  }

  return {
    domain: extractDomain(domain) ?? "",
    scanStatus,
    user,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const raw = (form.get("domain") as string).trim();
  const domain = extractDomain(raw);
  if (!domain) return { error: "Enter a valid website URL" };
  return redirect(`/try?domain=${encodeURIComponent(domain)}`);
}

export default function TryPage({ loaderData }: Route.ComponentProps) {
  const { domain, user } = loaderData;
  const actionData = useActionData<typeof action>();
  const [lines, setLines] = useState<string[]>(
    loaderData.scanStatus?.lines ?? [],
  );
  const [scanStatus, setScanStatus] = useState<string>(
    loaderData.scanStatus?.status ?? "idle",
  );
  const [result, setResult] = useState<ScanResult | undefined>(
    loaderData.scanStatus?.result ?? undefined,
  );
  const [scanError, setScanError] = useState<string | null>(
    loaderData.scanStatus?.error ?? null,
  );
  const startedRef = useRef(false);
  const [progressVisible, setProgressVisible] = useState(true);
  const [resultVisible, setResultVisible] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkStates = useMemo(() => {
    const states: Record<
      string,
      {
        status: "pending" | "running" | "passed" | "failed";
        message?: string;
        current?: number;
        total?: number;
      }
    > = {};
    for (const name of Object.values(LOG_TO_CHECK))
      states[name] = { status: "pending" };

    let currentCheck: string | null = null;
    for (const line of lines) {
      const checkMatch = line.match(/^Checking ([a-z0-9 \-/()]+?)\.\.\./i);
      if (checkMatch) {
        const normalized = checkMatch[1].toLowerCase().trim();
        currentCheck = LOG_TO_CHECK[normalized];
        if (currentCheck) {
          const pageCountMatch = line.match(/\.\.\. \((\d+)\/(\d+)\)$/);
          if (pageCountMatch) {
            states[currentCheck] = {
              status: "running",
              current: parseInt(pageCountMatch[1]),
              total: parseInt(pageCountMatch[2]),
            };
          } else {
            states[currentCheck] = { status: "running" };
          }
        }
        continue;
      }

      const resultMatch = line.match(/^([✓✗]) (.+)$/);
      if (resultMatch && currentCheck) {
        const isPassed = resultMatch[1] === "✓";
        states[currentCheck] = {
          status: isPassed ? "passed" : "failed",
          message: resultMatch[2],
        };
        currentCheck = null;
      }
    }

    if (result) {
      for (const check of result.checks) {
        if (states[check.name]) {
          states[check.name] = {
            status: check.passed ? "passed" : "failed",
            message: check.message,
          };
        }
      }
    }

    return states;
  }, [lines, result]);

  useEffect(() => {
    startedRef.current = false;
    setLines(loaderData.scanStatus?.lines ?? []);
    setScanStatus(loaderData.scanStatus?.status ?? "idle");
    setResult(loaderData.scanStatus?.result ?? undefined);
    setScanError(loaderData.scanStatus?.error ?? null);
    setProgressVisible(true);
    setResultVisible(false);
  }, [loaderData.domain]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scanStatus === "complete") {
      fadeTimerRef.current = setTimeout(() => {
        setProgressVisible(false);
        setTimeout(() => setResultVisible(true), 500);
      }, 2500);
    }
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [scanStatus]);

  useEffect(() => {
    if (startedRef.current) return;
    if (!domain || scanStatus !== "idle") return;
    startedRef.current = true;
    setScanStatus("running");
    fetch("/try/start", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ domain }),
    }).catch(() => setScanError("Failed to start scan"));
  }, [domain, scanStatus]);

  useInterval(
    async () => {
      if (scanStatus === "complete" || scanStatus === "error") return;
      try {
        const res = await fetch(
          `/try/scan?domain=${encodeURIComponent(domain)}`,
        );
        const data = (await res.json()) as {
          lines?: string[];
          status: string;
        };
        if (data.lines) setLines(data.lines);
        setScanStatus(data.status as typeof scanStatus);
        if (data.status === "complete") {
          setResultVisible(true);
        }
      } catch {
        // network hiccup
      }
    },
    scanStatus === "running" ? 1500 : null,
  );

  useEffect(() => {
    if (domain) {
      const timer = setTimeout(() => {
        document
          .getElementById("scan-results")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [domain]);

  return (
    <Main className="w-full bg-[hsl(60,100%,99%)]">
      <LandingPageNav isSignedIn={!!user} />

      {domain ? (
        <section className="border-b-2 border-black bg-amber-400 px-6 py-4">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold">
            <GlobeIcon className="h-4 w-4 shrink-0 text-amber-500" /> Checking{" "}
            {domain}
          </h1>
        </section>
      ) : (
        <section className="border-b-2 border-black bg-amber-400 px-6 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 text-4xl font-bold text-black md:text-5xl">
              Is your site ready for AI?
            </h1>
            <p className="mx-auto mb-10 max-w-xl text-lg font-medium text-black/80">
              Enter any URL. We scan your site's AI legibility in seconds and
              give you step-by-step prompts to fix what's missing. See how your
              site stacks up against the competition.
            </p>

            <DomainForm
              domain={domain}
              actionError={
                actionData && "error" in actionData ? actionData.error : null
              }
            />
          </div>
        </section>
      )}

      {domain ? (
        <>
          <section
            id="scan-results"
            className="border-b-2 border-black px-6 py-16"
          >
            <div className="mx-auto max-w-3xl">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="rounded-base inline-flex items-center gap-2 border-2 border-black bg-white px-3 py-1.5 text-sm font-bold shadow-[2px_2px_0px_0px_black]">
                  <GlobeIcon className="h-4 w-4 shrink-0 text-amber-500" />
                  {domain}
                </div>
                {scanStatus === "complete" && (
                  <div className="rounded-base inline-flex items-center gap-2 border-2 border-black bg-green-100 px-3 py-1.5 text-sm font-bold shadow-[2px_2px_0px_0px_black]">
                    <CheckIcon className="h-4 w-4 shrink-0 text-green-600" />
                    Scan complete
                  </div>
                )}
              </div>

              {scanStatus !== "idle" && scanStatus !== "error" && (
                <div
                  className={`overflow-hidden transition-all duration-500 ease-in-out ${
                    progressVisible
                      ? "max-h-[3000px] opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <LiveScanProgress checkStates={checkStates} lines={lines} />
                </div>
              )}

              {scanStatus === "error" && (
                <Card variant="yellow" className="border-red-400">
                  <CardContent>
                    <p className="font-bold text-red-600">
                      {scanError || "Something went wrong. Try again."}
                    </p>
                  </CardContent>
                </Card>
              )}

              {scanStatus === "complete" && result && (
                <div
                  className={`transition-all duration-500 ease-in-out ${
                    !progressVisible && resultVisible
                      ? "translate-y-0 opacity-100"
                      : "translate-y-4 opacity-0"
                  }`}
                  style={{ pointerEvents: resultVisible ? "auto" : "none" }}
                >
                  <ScanResults result={result} user={user} />
                </div>
              )}
            </div>
          </section>

          {scanStatus === "complete" && (
            <section className="px-6 py-16 text-center">
              <Button variant="secondary" as="a" href="/try" size="xl">
                <SearchIcon className="h-4 w-4" />
                Check another site
              </Button>
            </section>
          )}
        </>
      ) : (
        <BenefitsSection />
      )}

      {!user && <SignUpSection domain={domain} />}
    </Main>
  );
}

function DomainForm({
  domain,
  actionError,
}: {
  domain: string;
  actionError: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const displayedError = error || actionError;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const raw = (new FormData(form).get("domain") as string)?.trim();
    if (!raw) {
      e.preventDefault();
      setError("Enter a website URL");
      return;
    }
    setError(null);
  };

  return (
    <Form method="post" className="mx-auto max-w-xl" onSubmit={handleSubmit}>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <GlobeIcon className="pointer-events-none absolute top-1/2 left-4 z-10 h-5 w-5 -translate-y-1/2 text-black/40" />
          <input
            name="domain"
            key={domain}
            defaultValue={domain || ""}
            placeholder="yourwebsite.com"
            className="rounded-base h-14 w-full border-2 border-black bg-white pr-4 pl-12 text-lg font-bold shadow-[4px_4px_0px_0px_black] transition-all outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[6px_6px_0px_0px_black]"
          />
        </div>
        <Button type="submit" size="xl" className="h-14 shrink-0">
          <SearchIcon className="h-5 w-5" />
          Scan now
        </Button>
      </div>
      {displayedError && (
        <p className="mt-3 text-left text-sm font-bold text-red-600">
          {displayedError}
        </p>
      )}
      {!displayedError && domain && (
        <p className="mt-3 text-left text-xs font-medium text-black/40">
          Scan takes ~15 seconds
        </p>
      )}
    </Form>
  );
}
