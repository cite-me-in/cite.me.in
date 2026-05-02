/**
 * The category of a check: discovered, trusted, welcomed. This indicates the
 * purpose of the check and the expected outcome.
 */
type CheckCategory = "discovered" | "trusted" | "welcomed";

/**
 * The result of scanning a site for AI legibility issues.
 */
export type ScanResult = {
  checks: CheckResult[];
  scannedAt: string;
  suggestions?: Suggestion[];
  summary: {
    discovered: { passed: number; total: number };
    trusted: { passed: number; total: number };
    welcomed: { passed: number; total: number };
  };
  url: string;
};

/**
 * A single check result (eg robots.txt, sitemap.xml, etc.)
 */
export type CheckResult = {
  category: CheckCategory;
  detail?: CheckDetail;
  details?: Record<string, unknown>;
  message: string;
  name: string;
  passed: boolean;
  timedOut?: boolean;
};

/**
 * The details of a check result (eg robots.txt, sitemap.xml, etc.)
 */
export type CheckDetail = {
  effort: "2 min" | "5 min" | "15 min" | "1 hour";
  fixExample?: string;
  goal: string;
  howToImplement: string;
  issue: string;
  resourceLinks: { label: string; url: string }[];
  skillURL?: string;
};

/**
 * A suggestion for improving the AI legibility of a site. Not a failed check,
 * since these are not required or expected to be fixed.
 */
export type Suggestion = {
  description: string;
  effort: string;
  resourceLinks: { label: string; url: string }[];
  title: string;
};

/**
 * The progress of a scan. Anonymous scans are tracked in Redis, logged-in scans
 * are tracked in the database.
 */
export type ScanProgress = {
  lines: string[];
  done: boolean;
  nextOffset: number;
  result?: ScanResult;
};

/**
 * A page fetched and cached during a scan, shared across checks.
 */
export type FetchedPage = {
  html: string;
  ok: boolean;
  status: number;
  timedOut: boolean;
  url: string;
  error?: string;
  headers: Record<string, string>;
};
