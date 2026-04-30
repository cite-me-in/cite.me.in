import { runScanSteps } from "~/lib/aiLegibility/runAILegibilityScan";
import type { ScanResult } from "~/lib/aiLegibility/types";
import { getDomainMeta } from "~/lib/domainMeta.server";

type ScanState = {
  lines: string[];
  status: "idle" | "running" | "complete" | "error";
  result: ScanResult | null;
  error: string | null;
  startedAt: number;
};

const scans = new Map<string, ScanState>();
const SCAN_TTL = 5 * 60 * 1000;

function getOrCreate(domain: string): ScanState {
  const now = Date.now();
  for (const [key, state] of scans) {
    if (now - state.startedAt > SCAN_TTL) scans.delete(key);
  }
  let state = scans.get(domain);
  if (!state) {
    state = {
      lines: [],
      status: "idle",
      result: null,
      error: null,
      startedAt: now,
    };
    scans.set(domain, state);
  }
  return state;
}

export function getScanStatus(domain: string) {
  const state = scans.get(domain);
  if (!state) return null;
  return {
    lines: state.lines.slice(),
    status: state.status,
    result: state.result,
    error: state.error,
  };
}

function log(domain: string, line: string) {
  const state = getOrCreate(domain);
  state.lines.push(line);
}

export function startScan(domain: string) {
  const lower = domain.toLowerCase();
  const state = getOrCreate(lower);
  if (state.status === "running") return;
  state.status = "running";
  state.lines = [];
  state.result = null;
  state.error = null;
  state.startedAt = Date.now();
  runScan(domain).catch(() => {});
}

async function runScan(domain: string) {
  const lower = domain.toLowerCase();

  try {
    log(lower, `Looking up ${domain}...`);
    const meta = await getDomainMeta(domain);
    log(lower, `Found site: ${meta.brandName}`);

    log(lower, "Running AI legibility check...");
    const result = await runScanSteps({
      log: (line) => log(lower, line),
      domain,
    });

    const state = scans.get(lower);
    if (!state) return;

    const passed = result.checks.filter((c) => c.passed).length;
    const total = result.checks.length;

    log(lower, `${passed}/${total} checks passed`);
    state.result = result;
    state.status = "complete";
  } catch (error) {
    const state = scans.get(lower);
    if (state) {
      state.status = "error";
      state.error =
        error instanceof Error ? error.message : "Scan failed. Try again.";
    }
  }
}
