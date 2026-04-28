import { ChevronDownIcon, ChevronUpIcon, CopyIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import type { CheckResult } from "~/lib/aiLegibility/types";

function buildPrompt(check: CheckResult) {
  if (!check.detail) return "";
  const docs = check.detail.resourceLinks
    .map((l) => l.url)
    .join(", ");
  const parts = [
    `Goal: ${check.detail.goal}`,
    `Issue: ${check.message}`,
    `Fix: ${check.detail.howToImplement}`,
  ];
  if (check.detail.skillUrl) {
    parts.push(`Skill: ${check.detail.skillUrl}`);
  }
  if (docs) {
    parts.push(`Docs: ${docs}`);
  }
  return parts.join("\n\n");
}

export default function ExpandableCheckCard({ check }: { check: CheckResult }) {
  const [open, setOpen] = useState(!check.passed);
  const [showAudit, setShowAudit] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    setOpen(!open);
    setShowAudit(false);
  };

  return (
    <div className="rounded-base border-2 border-border overflow-hidden">
      <button
        onClick={toggle}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
          check.passed ? "bg-green-50" : "bg-red-50"
        }`}
      >
        <span
          className={`text-lg ${check.passed ? "text-green-600" : "text-red-600"}`}
        >
          {check.passed ? "✓" : "✗"}
        </span>
        <span className="font-bold">
          {check.passed ? "Pass" : "Fail"}{" "}
          <span className="font-normal">{check.name}</span>
        </span>
        <span className="ml-auto mr-2 text-sm text-foreground/60">
          {check.message}
        </span>
        {open ? (
          <ChevronUpIcon className="size-4 shrink-0" />
        ) : (
          <ChevronDownIcon className="size-4 shrink-0" />
        )}
      </button>

      {open && check.detail && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {!showAudit ? (
            <>
              <DetailBlock term="Goal">
                {check.detail.goal}
              </DetailBlock>

              <DetailBlock term="Issue">
                {check.message}
              </DetailBlock>

              <DetailBlock term="How to implement">
                {check.detail.howToImplement}
              </DetailBlock>

              {check.detail.resourceLinks.length > 0 && (
                <div>
                  <h4 className="mb-1 text-sm font-semibold text-foreground/70">
                    Resources
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {check.detail.resourceLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Badge
                          variant="neutral"
                          className="cursor-pointer hover:bg-neutral-200"
                        >
                          {link.label}
                        </Badge>
                      </a>
                    ))}
                    {check.detail.skillUrl && (
                      <a
                        href={check.detail.skillUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Badge
                          variant="neutral"
                          className="cursor-pointer hover:bg-neutral-200"
                        >
                          Skill
                        </Badge>
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigator.clipboard.writeText(buildPrompt(check))
                  }
                >
                  <CopyIcon className="size-3" />
                  Copy prompt
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAudit(true)}
                >
                  View audit details
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                {check.detail.auditSteps.map((step, i) => (
                  <div key={i} className="rounded-base border-2 border-border bg-secondary-background p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-main text-xs font-bold text-main-foreground">
                        {i + 1}
                      </span>
                      <span className="font-medium">{step.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground/60 ml-7">
                      {step.value}
                    </p>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAudit(false)}
              >
                Back to results
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DetailBlock({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold text-foreground/70">{term}</h4>
      <p className="text-sm text-foreground/80">{children}</p>
    </div>
  );
}
