import {
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  LayoutDashboardIcon,
  SparklesIcon,
  XCircleIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/Dialog";
import buildPrompt from "~/lib/aiLegibility/buildPrompt";
import CATEGORIES from "~/lib/aiLegibility/checkDetails";
import type { CheckResult, ScanResult } from "~/lib/aiLegibility/types";

export default function ScanResults({
  result,
  user,
}: {
  result: ScanResult;
  user: unknown;
}) {
  const totalPassed = result.checks.filter((c) => c.passed).length;
  const totalChecks = result.checks.length;
  const score = Math.round((totalPassed / totalChecks) * 100);
  const showCelebration = totalPassed === totalChecks;

  return (
    <div className="space-y-8">
      {showCelebration && (
        <div className="rounded-base border-2 border-black bg-green-100 p-6 text-center shadow-[4px_4px_0px_0px_black]">
          <CheckCircleIcon className="mx-auto mb-2 h-8 w-8 text-green-600" />
          <h3 className="text-xl font-bold text-green-800">
            All {totalChecks} checks passed!
          </h3>
          <p className="mt-1 text-green-700">
            Your site is well-optimized for AI discovery.
          </p>
        </div>
      )}

      <ScoreGauge score={score} />

      <Card variant="yellow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-amber-500" />
            AI Legibility Report — {totalPassed}/{totalChecks} passed
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

          {totalPassed < totalChecks && (
            <>
              <QuickWinCard
                failedChecks={result.checks.filter((c) => !c.passed)}
              />
              <ImproveSiteModal
                failedChecks={result.checks.filter((c) => !c.passed)}
              />
            </>
          )}

          {CATEGORIES.map((cat) => {
            const checks = result.checks.filter((c) => c.category === cat.key);
            if (checks.length === 0) return null;

            const failed = checks.filter((c: CheckResult) => !c.passed);
            const passed = checks.filter((c: CheckResult) => c.passed);

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
        Now see if it's working
      </h3>
      <p className="mb-6 font-medium text-black/70">
        Legibility is necessary but not sufficient. With a paid plan, we run{" "}
        <strong>9 targeted queries</strong> across ChatGPT, Claude, Gemini,
        Copilot, and Perplexity every week — so you know exactly what's working.
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
          href="/sign-up?source=try"
          className="rounded-base inline-flex w-full items-center justify-center gap-2 border-2 border-black bg-amber-400 px-8 py-4 text-lg font-bold shadow-[4px_4px_0px_0px_black] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_black]"
        >
          Start monitoring — free
        </a>
      )}
    </div>
  );
}

function ImproveSiteModal({ failedChecks }: { failedChecks: CheckResult[] }) {
  const allPrompts = failedChecks.map(buildPrompt).join("\n\n---\n\n");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyAll = async () => {
    await navigator.clipboard.writeText(allPrompts);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="rounded-base inline-flex w-full items-center justify-center gap-2 border-2 border-black bg-emerald-400 px-8 py-4 text-lg font-bold shadow-[4px_4px_0px_0px_black] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_black]"
        onClick={() => setOpen(true)}
      >
        <SparklesIcon className="h-5 w-5" />
        Fix with AI prompts
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogContent className="rounded-base fixed top-[50%] left-[50%] z-50 flex max-h-[80vh] w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] flex-col gap-4 border-2 border-black bg-white p-6 shadow-[8px_8px_0px_0px_black] transition-all duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <DialogTitle className="font-heading pr-8 text-xl">
            Fix in minutes with your coding agent
          </DialogTitle>
          <DialogDescription className="font-base text-sm text-black/60">
            Copy the prompts below and paste them into Cursor, Copilot, or
            Claude. Each one includes an example fix — just paste and let your
            AI handle it.
          </DialogDescription>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <textarea
              className="rounded-base min-h-[30vh] w-full resize-none border-2 border-black bg-[hsl(60,100%,97%)] p-4 font-mono text-sm"
              value={allPrompts}
              readOnly
            />
          </div>

          <div className="flex items-center justify-between border-t-2 border-black pt-4">
            <span className="text-sm font-medium text-black/50">
              {failedChecks.length} issue
              {failedChecks.length > 1 ? "s" : ""} to fix
            </span>
            <button
              onClick={handleCopyAll}
              className="rounded-base inline-flex items-center gap-2 border-2 border-black bg-amber-400 px-6 py-3 text-sm font-bold shadow-[3px_3px_0px_0px_black] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_black]"
            >
              {copied ? (
                <>
                  <CheckIcon className="size-4" />
                  Copied!
                </>
              ) : (
                <>
                  <CopyIcon className="size-4" />
                  Copy all instructions
                </>
              )}
            </button>
          </div>

          <DialogClose className="rounded-base absolute top-4 right-4 p-1 transition-colors hover:bg-black/5">
            <XIcon className="size-5" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogContent>
      </DialogPortal>
    </Dialog>
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

function ScoreGauge({ score }: { score: number }) {
  const grade =
    score >= 90
      ? "A+"
      : score >= 80
        ? "A"
        : score >= 70
          ? "B"
          : score >= 60
            ? "C"
            : score >= 50
              ? "D"
              : "F";

  return (
    <div className="rounded-base border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_black]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-black/50">
            AI Legibility Score
          </div>
          <div className="text-5xl font-black">{score}</div>
        </div>
        <div className="text-6xl font-black">{grade}</div>
      </div>
      <div className="rounded-base h-4 w-full overflow-hidden border-2 border-black bg-gray-100">
        <div
          className="h-full bg-amber-400 transition-all duration-500"
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="mt-3 text-sm font-medium text-black/50">
        Most sites score 45-65.{" "}
        {score >= 65 ? "You're above average!" : "There's room to improve."}
      </p>
    </div>
  );
}

const EFFORT_ORDER: Record<string, number> = {
  "2 min": 0,
  "5 min": 1,
  "15 min": 2,
  "1 hour": 3,
};

function QuickWinCard({ failedChecks }: { failedChecks: CheckResult[] }) {
  const quickWin = failedChecks.reduce<CheckResult | null>((best, c) => {
    const e = c.detail?.effort;
    if (!e) return best;
    if (!best) return c;
    return (EFFORT_ORDER[e] ?? 99) <
      (EFFORT_ORDER[best.detail?.effort ?? "1 hour"] ?? 99)
      ? c
      : best;
  }, null);
  const [copied, setCopied] = useState(false);

  if (!quickWin?.detail) return null;

  const prompt = buildPrompt(quickWin);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-base border-2 border-emerald-500 bg-emerald-50 p-5 shadow-[4px_4px_0px_0px_#059669]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
          <ZapIcon className="h-5 w-5" />
          Quick win
        </h3>
        <span className="rounded-base border-2 border-emerald-500 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
          {quickWin.detail.effort} fix
        </span>
      </div>

      <p className="mb-3 text-sm font-medium text-emerald-800">
        <strong>{quickWin.message}</strong>
      </p>

      <p className="mb-3 text-xs font-medium text-emerald-700">
        {quickWin.detail.issue}
      </p>

      <textarea
        className="rounded-base mb-3 w-full resize-none border-2 border-emerald-400 bg-white p-3 font-mono text-xs text-emerald-900"
        value={prompt}
        readOnly
        rows={6}
      />

      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-emerald-700">
          Copy this prompt and paste it into your AI coding agent (Claude Code,
          Cursor, Copilot, Codex) — it will fix the code in minutes.
        </span>
        <button
          onClick={handleCopy}
          className="rounded-base inline-flex shrink-0 items-center gap-2 border-2 border-emerald-600 bg-emerald-400 px-4 py-2 text-xs font-bold shadow-[3px_3px_0px_0px_#059669] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_#059669]"
        >
          {copied ? (
            <>
              <CheckIcon className="size-3" />
              Copied!
            </>
          ) : (
            <>
              <CopyIcon className="size-3" />
              Copy prompt
            </>
          )}
        </button>
      </div>
    </div>
  );
}
