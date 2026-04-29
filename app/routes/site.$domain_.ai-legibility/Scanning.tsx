import { ms } from "convert";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useInterval } from "usehooks-ts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import Spinner from "~/components/ui/Spinner";
import type { ScanResult } from "~/lib/aiLegibility/types";

export default function Scanning({ domain }: { domain: string }) {
  const navigate = useNavigate();

  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const offsetRef = useRef(0);
  const logRef = useRef<HTMLPreElement>(null);

  const handlePoll = useCallback(async () => {
    try {
      const res = await fetch(
        `/site/${domain}/ai-legibility/status?offset=${offsetRef.current}`,
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
        setTimeout(() => navigate("."), 1000);
      }
    } catch (error) {
      console.error("[Scanning] Poll error:", error);
    }
  }, [domain, done, navigate]);

  useInterval(handlePoll, done ? null : ms("1s"));

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Spinner />
          Scanning…
        </CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-foreground/60 mb-4">
          Scanning: <code className="font-mono">{domain}</code>
        </p>
        <pre
          ref={logRef}
          className="border-border bg-muted text-foreground/60 h-96 overflow-y-auto rounded border p-4 font-mono text-sm leading-relaxed whitespace-break-spaces"
        >
          {lines.length === 0 && (
            <span className="text-foreground/40">Starting…</span>
          )}
          {lines.map((line, i) => (
            <div key={i.toString()}>{line}</div>
          ))}
        </pre>
      </CardContent>
    </Card>
  );
}
