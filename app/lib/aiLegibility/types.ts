type CheckCategory = "discovered" | "trusted" | "welcomed";

export type CheckDetail = {
  goal: string;
  issue: string;
  howToImplement: string;
  fixExample?: string;
  effort: "2 min" | "5 min" | "15 min" | "1 hour";
  resourceLinks: { label: string; url: string }[];
  skillURL?: string;
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

export type ScanResult = {
  url: string;
  scannedAt: string;
  checks: CheckResult[];
  suggestions?: Suggestion[];
  summary: {
    discovered: { passed: number; total: number };
    trusted: { passed: number; total: number };
    welcomed: { passed: number; total: number };
  };
};

export type Suggestion = {
  title: string;
  description: string;
  effort: string;
  resourceLinks: { label: string; url: string }[];
};

export type ScanProgress = {
  lines: string[];
  done: boolean;
  nextOffset: number;
  result?: ScanResult;
};
