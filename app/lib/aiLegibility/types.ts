type CheckCategory = "critical" | "important" | "optimization";

export type CheckDetail = {
  goal: string;
  issue: string;
  howToImplement: string;
  resourceLinks: { label: string; url: string }[];
  skillUrl?: string;
  auditSteps: { label: string; value: string }[];
};

export type CheckResult = {
  name: string;
  category: CheckCategory;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
  timedOut?: boolean;
  detail?: CheckDetail;
};

export type Suggestion = {
  title: string;
  category: CheckCategory;
  effort: "2 min" | "5 min" | "15 min" | "1 hour";
  description: string;
  fixExample?: string;
};

export type ScanResult = {
  url: string;
  scannedAt: string;
  checks: CheckResult[];
  summary: {
    critical: { passed: number; total: number };
    important: { passed: number; total: number };
    optimization: { passed: number; total: number };
  };
  suggestions: Suggestion[];
};

export type ScanProgress = {
  lines: string[];
  done: boolean;
  nextOffset: number;
  result?: ScanResult;
};
