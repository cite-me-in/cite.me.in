import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/Accordion";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import CATEGORIES from "~/lib/aiLegibility/criteria";
import type { CheckResult } from "~/lib/aiLegibility/types";

export default function ScanResults({ checks }: { checks: CheckResult[] }) {
  const groupedChecks = CATEGORIES.map((category) => ({
    ...category,
    checks: checks.filter((c) => c.category === category.key),
  }));

  return (
    <>
      {groupedChecks.map((group) =>
        group.checks.length > 0 ? (
          <div
            key={group.key}
            id={`section-${group.key}`}
            className="scroll-mt-20 space-y-2"
          >
            <h3 className={`text-lg font-bold ${group.color}`}>
              {group.title}
            </h3>
            <Accordion
              defaultValue={group.checks
                .filter((c) => !c.passed)
                .map((c) => c.name)}
              className="space-y-2"
              multiple
            >
              {group.checks.map((check, i) => (
                <ExpandableCheckCard key={i} check={check} />
              ))}
            </Accordion>
          </div>
        ) : null,
      )}
    </>
  );
}

function ExpandableCheckCard({ check }: { check: CheckResult }) {
  const [showAudit, setShowAudit] = useState(false);

  return (
    <AccordionItem
      value={check.name}
      className="rounded-base border-border bg-secondary-background overflow-hidden border-2"
    >
      <AccordionTrigger
        className={`flex items-center gap-3 px-4 py-3 hover:no-underline ${
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
      </AccordionTrigger>

      {check.detail && (
        <AccordionContent>
          <div className="border-border border-t px-4 py-4">
            <div
              className="check-card-container"
              style={{ perspective: "1000px", position: "relative" }}
            >
              <div
                className="check-card-inner"
                style={{
                  transition: "transform 0.5s ease",
                  transformStyle: "preserve-3d",
                  transform: showAudit ? "rotateY(180deg)" : "rotateY(0deg)",
                  minHeight: "100%",
                }}
              >
                <div
                  className="check-card-front"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <CheckSummary check={check} setShowAudit={setShowAudit} />
                </div>
                <div
                  className="check-card-back"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    position: "absolute",
                    inset: 0,
                  }}
                >
                  <CheckAuditDetails
                    check={check}
                    setShowAudit={setShowAudit}
                  />
                </div>
              </div>
            </div>
          </div>
        </AccordionContent>
      )}
    </AccordionItem>
  );
}

function CheckSummary({
  check,
  setShowAudit,
}: {
  check: CheckResult;
  setShowAudit: (show: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildPrompt(check));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {check.detail && (
        <DetailBlock term="Goal">{check.detail.goal}</DetailBlock>
      )}

      <DetailBlock term="Issue">{check.message}</DetailBlock>

      {check.detail && (
        <DetailBlock term="How to implement">
          {check.detail.howToImplement}
        </DetailBlock>
      )}

      {check.detail?.fixExample && (
        <div>
          <h4 className="text-foreground/70 mb-1 text-base font-semibold">
            Example
          </h4>
          <pre className="bg-muted overflow-x-auto rounded p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {check.detail.fixExample}
          </pre>
        </div>
      )}

      {check.detail && check.detail.resourceLinks.length > 0 && (
        <div>
          <h4 className="text-foreground/70 mb-1 text-base font-semibold">
            Resources
          </h4>
          <div className="flex flex-wrap gap-2">
            {check.detail.resourceLinks.map((link, i) => (
              <Link
                key={i}
                to={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Badge
                  variant="neutral"
                  className="cursor-pointer hover:bg-neutral-200"
                >
                  {link.label}
                </Badge>
              </Link>
            ))}
            {check.detail.skillUrl && (
              <Link
                to={check.detail.skillUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Badge
                  variant="neutral"
                  className="cursor-pointer hover:bg-neutral-200"
                >
                  Skill
                </Badge>
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant={copied ? "default" : "outline"}
          onClick={handleCopy}
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
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowAudit(true)}>
          Audit details
          <ArrowRightIcon className="size-3" />
        </Button>
      </div>
    </div>
  );
}

function DetailBlock({ term, children }: { term: string; children: string }) {
  return (
    <div>
      <h4 className="text-foreground/70 mb-1 text-base font-semibold">
        {term}
      </h4>
      <p className="text-foreground/80 text-base">{children}</p>
    </div>
  );
}

function CheckAuditDetails({
  check,
  setShowAudit,
}: {
  check: CheckResult;
  setShowAudit: (show: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {check.detail?.auditSteps.map((step, i) => (
          <div
            key={i}
            className="rounded-base border-border bg-secondary-background border-2 p-3"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="bg-main text-main-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {i + 1}
              </span>
              <span className="font-medium">{step.label}</span>
            </div>
            <p className="text-foreground/60 mt-1 ml-7 text-sm">{step.value}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowAudit(false)}>
          <ArrowLeftIcon className="size-3" />
          Back
        </Button>
      </div>
    </div>
  );
}

function buildPrompt(check: CheckResult) {
  if (!check.detail) return "";
  const docs = check.detail.resourceLinks.map((l) => l.url).join(", ");
  const parts = [
    `Goal: ${check.detail.goal}`,
    `Issue: ${check.message}`,
    `Fix: ${check.detail.howToImplement}`,
  ];
  if (check.detail.fixExample)
    parts.push(`Example:\n\`\`\`\n${check.detail.fixExample}\n\`\`\``);
  if (check.detail.skillUrl) parts.push(`Skill: ${check.detail.skillUrl}`);
  if (docs) parts.push(`Docs: ${docs}`);
  return parts.join("\n\n");
}
