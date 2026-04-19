import { ms } from "convert";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useInterval } from "usehooks-ts";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Field, FieldLabel } from "~/components/ui/FieldSet";
import { Input } from "~/components/ui/Input";
import Main from "~/components/ui/Main";
import Spinner from "~/components/ui/Spinner";
import type { ScanResult } from "~/lib/aiLegibility/types";
import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "AI Legibility Checker | Cite.me.in" },
    {
      name: "description",
      content:
        "Check if your website is readable by AI agents like ChatGPT, Claude, and Gemini. Get actionable suggestions to improve AI discoverability.",
    },
  ];
}

export default function AiLegibilityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const scanIdFromUrl = searchParams.get("scanId");
  const urlFromParams = searchParams.get("url");

  const [scanId, setScanId] = useState<string | null>(scanIdFromUrl);
  const [url, setUrl] = useState<string | null>(urlFromParams);
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const logRef = useRef<HTMLPreElement>(null);

  // Poll for progress when we have a scanId
  useInterval(
    async () => {
      if (!scanId) return;
      try {
        const res = await fetch(
          `/ai-legibility/status?scanId=${scanId}&offset=${offsetRef.current}`,
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
          // Wait 1-1.5s then navigate
          const delay = 1000 + Math.random() * 500;
          setTimeout(() => {
            navigate(`/ai-legibility/${scanId}`);
          }, delay);
        }
      } catch {
        // Network hiccup — keep polling.
      }
    },
    done || error || !scanId ? null : ms("1s"),
  );

  // Auto-scroll log to bottom
  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  });

  // Handle new scan started - update URL
  const handleScanStart = (data: { scanId: string; url: string }) => {
    setScanId(data.scanId);
    setUrl(data.url);
    setLines([]);
    setDone(false);
    setError(null);
    offsetRef.current = 0;

    // Update URL with scanId for reload/share
    setSearchParams({ scanId: data.scanId, url: data.url });
  };

  return (
    <Main variant="wide">
      <div className="mx-auto max-w-4xl py-12">
        <div className="mb-12 text-center">
          <h1 className="mb-4 font-bold text-4xl text-black md:text-5xl">
            AI Legibility Checker
          </h1>
          <p className="text-black/60 text-lg">
            Check if your website is readable by AI agents like ChatGPT, Claude,
            and Gemini. Get actionable suggestions to improve discoverability.
          </p>
        </div>

        {scanId ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {(loading || (!done && !error)) && <Spinner />}
                {loading
                  ? "Loading results…"
                  : done
                    ? "Scan complete"
                    : error
                      ? "Something went wrong"
                      : "Scanning…"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {url && (
                <p className="mb-4 text-foreground/60">
                  Scanning: <code className="font-mono">{url}</code>
                </p>
              )}
              <pre
                ref={logRef}
                className="h-96 overflow-y-auto whitespace-break-spaces rounded border border-border bg-muted p-4 font-mono text-foreground/60 text-sm leading-relaxed"
              >
                {lines.length === 0 && !done && (
                  <span className="text-foreground/40">Starting…</span>
                )}
                {lines.map((line, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: lines are append-only, index is stable
                  <div key={i}>{line}</div>
                ))}
                {loading && (
                  <div className="mt-2 font-semibold text-green-700">
                    ✓ Loading results…
                  </div>
                )}
                {error && (
                  <div className="mt-2 font-semibold text-red-700">
                    ✗ {error}
                  </div>
                )}
              </pre>
            </CardContent>
          </Card>
        ) : (
          <ScanForm onError={setError} onScan={handleScanStart} />
        )}

        {error && !scanId && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}
      </div>
    </Main>
  );
}

function ScanForm({
  onScan,
  onError,
}: {
  onScan: (data: { scanId: string; url: string }) => void;
  onError: (error: string) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    onError("");

    const formData = new FormData(e.currentTarget);
    const url = formData.get("url")?.toString();

    if (!url) {
      onError("URL is required");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/ai-legibility/scan", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        onError(data.error || "Something went wrong");
        return;
      }

      onScan(data);
    } catch {
      onError("Failed to start scan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card variant="yellow">
      <CardHeader>
        <CardTitle>Check your website</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-base text-foreground/60">
            Enter your website URL to check if it&apos;s readable by AI agents.
          </p>
          <Field>
            <FieldLabel htmlFor="url">Website URL</FieldLabel>
            <div className="flex justify-between gap-4">
              <Input
                aria-label="Website URL"
                autoFocus
                id="url"
                name="url"
                placeholder="https://yoursite.com"
                type="text"
                disabled={isSubmitting}
              />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Starting…" : "Scan Website"}
              </Button>
            </div>
          </Field>
        </form>
      </CardContent>
    </Card>
  );
}
