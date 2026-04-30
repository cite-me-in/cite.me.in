import {
  Building2Icon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  SearchIcon,
  SparklesIcon,
  XCircleIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Form, redirect, useActionData } from "react-router";
import { useInterval } from "usehooks-ts";
import CiteMeInLogo from "~/components/layout/CiteMeInLogo";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import CATEGORIES from "~/lib/aiLegibility/criteria";
import type { ScanResult } from "~/lib/aiLegibility/types";
import { requireUserAccess } from "~/lib/auth.server";
import { extractDomain } from "~/lib/sites.server";
import { getScanStatus } from "~/lib/tryScan.server";
import type { Route } from "./+types/route";

export const handle = { hideHeader: true };

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain") ?? "";
  const user = await requireUserAccess(request).catch(() => null);

  let scanStatus = null;
  if (domain) {
    const d = extractDomain(domain);
    if (d) scanStatus = getScanStatus(d);
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
  const logRef = useRef<HTMLDivElement>(null);

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
          result?: ScanResult;
          error?: string;
        };
        setLines(data.lines ?? []);
        if (data.status === "complete") {
          setScanStatus("complete");
          setResult(data.result);
        } else if (data.status === "error") {
          setScanStatus("error");
          setScanError(data.error ?? "Scan failed");
        }
      } catch {
        // network hiccup
      }
    },
    scanStatus === "running" ? 1500 : null,
  );

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines]);

  return (
    <Main className="w-full bg-[hsl(60,100%,99%)]">
      <PageNav />

      <section className="border-b-2 border-black bg-amber-400 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-4 text-4xl font-bold text-black md:text-5xl">
            Is your site ready for AI?
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg font-medium text-black/80">
            Enter any website. We'll run 11 free checks to see if AI agents can
            find, trust, and cite your content.
          </p>

          <DomainForm
            domain={domain}
            actionError={
              actionData && "error" in actionData ? actionData.error : null
            }
          />
        </div>
      </section>

      {domain && (
        <section className="border-b-2 border-black px-6 py-16">
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

            {scanStatus === "running" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                    Checking {domain}...
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    ref={logRef}
                    className="max-h-64 space-y-1 overflow-y-auto font-mono text-sm text-black/60"
                  >
                    {lines.length === 0 && (
                      <div className="text-black/40">Starting scan...</div>
                    )}
                    {lines.map((line, i) => (
                      <div
                        key={i}
                        className={
                          i === lines.length - 1
                            ? "animate-pulse text-black"
                            : ""
                        }
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
              <ResultDisplay result={result} user={user} />
            )}
          </div>
        </section>
      )}

      {!domain && <BenefitsSection />}

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
          Check
        </Button>
      </div>
      {displayedError && (
        <p className="mt-3 text-left text-sm font-bold text-red-600">
          {displayedError}
        </p>
      )}
    </Form>
  );
}

function PageNav() {
  return (
    <nav className="flex items-center justify-between border-b-2 border-black bg-[hsl(60,100%,99%)] px-6 py-3">
      <CiteMeInLogo />
      <div className="flex items-center gap-3">
        <a
          href="/sign-in"
          className="rounded-base inline-flex items-center border-2 border-black bg-white px-4 py-2 text-sm font-bold shadow-[3px_3px_0px_0px_black] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_black]"
        >
          Sign in
        </a>
        <a
          href="/sign-up"
          className="rounded-base inline-flex items-center border-2 border-black bg-amber-400 px-4 py-2 text-sm font-bold shadow-[3px_3px_0px_0px_black] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_black]"
        >
          Get started
        </a>
      </div>
    </nav>
  );
}

function ResultDisplay({
  result,
  user,
}: {
  result: ScanResult;
  user: unknown;
}) {
  const totalPassed = result.checks.filter((c) => c.passed).length;
  const totalChecks = result.checks.length;
  const showCelebration = totalPassed === totalChecks;

  return (
    <div className="space-y-8">
      {showCelebration && (
        <div className="rounded-base border-2 border-black bg-green-100 p-6 text-center shadow-[4px_4px_0px_0px_black]">
          <CheckCircleIcon className="mx-auto mb-2 h-8 w-8 text-green-600" />
          <h3 className="text-xl font-bold text-green-800">
            All 11 checks passed!
          </h3>
          <p className="mt-1 text-green-700">
            Your site is well-optimized for AI discovery.
          </p>
        </div>
      )}

      <Card variant="yellow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2Icon className="h-5 w-5 text-amber-500" />
            AI Legibility Report — {totalPassed}/{totalChecks} checks passed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {CATEGORIES.map((cat) => {
              const checks = result.summary[cat.key];
              if (!checks) return null;
              return (
                <div
                  key={cat.key}
                  className="rounded-base border-2 border-black bg-white p-4 text-center shadow-[2px_2px_0px_0px_black]"
                >
                  <div className={`text-base font-bold ${cat.color}`}>
                    {cat.title}
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {checks.passed}/{checks.total}
                  </div>
                  <div className="text-sm text-black/50">checks passed</div>
                </div>
              );
            })}
          </div>

          {CATEGORIES.map((cat) => {
            const checks = result.checks.filter((c) => c.category === cat.key);
            if (checks.length === 0) return null;

            const failed = checks.filter((c) => !c.passed);
            const passed = checks.filter((c) => c.passed);

            return (
              <div key={cat.key}>
                <h3 className={`mb-2 font-bold ${cat.color}`}>{cat.title}</h3>
                <div className="space-y-2">
                  {failed.map((check) => (
                    <CheckRow key={check.name} check={check} />
                  ))}
                  {passed.length > 0 && <CollapsiblePassed passed={passed} />}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <UpgradeCard user={user} />
    </div>
  );
}

function CheckRow({
  check,
}: {
  check: { name: string; message: string; passed: boolean };
}) {
  return (
    <div
      className={`rounded-base flex items-start gap-3 border-2 border-black p-3 text-sm shadow-[2px_2px_0px_0px_black] ${
        check.passed ? "bg-green-50" : "bg-red-50"
      }`}
    >
      {check.passed ? (
        <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
      )}
      <div>
        <span className="font-bold">{check.name}</span>
        <span className="ml-1 text-black/60">{check.message}</span>
      </div>
    </div>
  );
}

function CollapsiblePassed({
  passed,
}: {
  passed: { name: string; message: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="rounded-base flex w-full items-center gap-2 border-2 border-dashed border-black bg-green-50/50 px-3 py-2 text-left text-sm font-medium text-green-700 transition-all hover:bg-green-50"
      >
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
        />
        {passed.length} check{passed.length > 1 ? "s" : ""} passed
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {passed.map((check) => (
            <CheckRow key={check.name} check={{ ...check, passed: true }} />
          ))}
        </div>
      )}
    </div>
  );
}

function UpgradeCard({ user }: { user: unknown }) {
  return (
    <div className="rounded-base border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_black]">
      <h3 className="mb-4 flex items-center gap-2 text-xl font-bold">
        <SparklesIcon className="h-5 w-5 text-amber-500" />
        See if AI actually cites your site
      </h3>
      <p className="mb-6 font-medium text-black/70">
        Legibility is one thing. Our weekly scans run{" "}
        <strong>9 targeted queries</strong> across all{" "}
        <strong>5 AI platforms</strong> — ChatGPT, Claude, Gemini, Copilot, and
        Perplexity — to find every citation, track trends, and measure your AI
        visibility over time.
      </p>

      {user ? (
        <a
          href="/sites"
          className="rounded-base inline-flex w-full items-center justify-center gap-2 border-2 border-black bg-amber-400 px-8 py-4 text-lg font-bold shadow-[4px_4px_0px_0px_black] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_black]"
        >
          <LayoutDashboardIcon className="h-5 w-5" />
          Go to your dashboard
        </a>
      ) : (
        <a
          href="/sign-up"
          className="rounded-base inline-flex w-full items-center justify-center gap-2 border-2 border-black bg-amber-400 px-8 py-4 text-lg font-bold shadow-[4px_4px_0px_0px_black] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_black]"
        >
          Start monitoring — free
        </a>
      )}
    </div>
  );
}

function BenefitsSection() {
  return (
    <section className="border-b-2 border-black px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">
          After your scan, you'll get
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <BenefitCard
            icon={SearchIcon}
            title="11 free checks"
            body="We test sitemaps, robots.txt, JSON-LD, meta tags, content quality, and more — all for free."
          />
          <BenefitCard
            icon={BarChartIcon}
            title="Know your gaps"
            body="See exactly which checks pass and which need fixing, with clear explanations for each."
          />
          <BenefitCard
            icon={ArrowRightIcon}
            title="One-click monitoring"
            body="Sign up to run 9 queries across all 5 AI platforms every week. Track trends over time."
          />
        </div>
      </div>
    </section>
  );
}

function BenefitCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-base flex flex-col gap-4 border-2 border-black bg-white p-6 text-base text-black shadow-[4px_4px_0px_0px_black]">
      <div className="rounded-base flex h-12 w-12 items-center justify-center border-2 border-black bg-amber-400 shadow-[2px_2px_0px_0px_black]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="leading-relaxed font-medium text-black/70">{body}</p>
    </div>
  );
}

function SignUpSection({ domain }: { domain: string }) {
  return (
    <section className="border-b-2 border-black bg-[hsl(47,100%,95%)] px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-bold md:text-4xl">
          Turn this into weekly monitoring
        </h2>
        <p className="mb-10 text-lg font-medium text-black/70">
          Create a free account. We'll add your site, run 9 queries across all 5
          platforms, and send you a weekly digest with what changed.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href={`/sign-up${domain ? `?next=/try?domain=${encodeURIComponent(domain)}` : ""}`}
            className="rounded-base inline-flex items-center gap-2 border-2 border-black bg-amber-400 px-8 py-4 text-lg font-bold shadow-[4px_4px_0px_0px_black] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_black]"
          >
            <SparklesIcon className="h-5 w-5" />
            Start monitoring — free
          </a>
          <a
            href="/pricing"
            className="rounded-base border-2 border-black bg-white px-8 py-4 text-lg font-bold shadow-[4px_4px_0px_0px_black] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_black]"
          >
            See pricing
          </a>
        </div>
      </div>
    </section>
  );
}

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
