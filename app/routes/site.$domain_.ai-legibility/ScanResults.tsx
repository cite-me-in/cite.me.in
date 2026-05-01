import {
  CheckCircleIcon,
  CheckIcon,
  CopyIcon,
  LightbulbIcon,
  XCircleIcon,
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
import buildPrompt from "~/lib/aiLegibility/buildPrompt";
import CATEGORIES from "~/lib/aiLegibility/checkDetails";
import type { CheckResult, ScanResult } from "~/lib/aiLegibility/types";

export default function ScanResults({ result }: { result: ScanResult }) {
  const { checks, suggestions } = result;
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
              {group.checks
                .filter((c) => !c.passed)
                .map((check, i) => (
                  <ExpandableCheckCard key={i} check={check} />
                ))}
            </Accordion>
            {group.checks.filter((c) => c.passed).length > 0 && (
              <div className="rounded-base border-border border-2 bg-green-50 px-4 py-2 text-sm text-green-700">
                {group.checks.filter((c) => c.passed).length} check
                {group.checks.filter((c) => c.passed).length > 1
                  ? "s"
                  : ""}{" "}
                passed
              </div>
            )}
          </div>
        ) : null,
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="rounded-base border-2 border-purple-300 bg-purple-50 p-6">
          <h3 className="flex items-center gap-2 text-lg font-bold text-purple-800">
            <LightbulbIcon className="size-5" />
            Suggestions to go further
          </h3>
          <p className="mt-1 text-sm text-purple-600">
            These are optional enhancements that can improve how AI agents
            discover and understand your content.
          </p>
          <div className="mt-4 space-y-3">
            {suggestions.map((s) => (
              <div
                key={s.title}
                className="rounded-base border-2 border-purple-300 bg-white p-4"
              >
                <h4 className="font-bold text-purple-900">{s.title}</h4>
                <p className="mt-1 text-sm text-purple-700">{s.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-purple-500">
                  <span>Effort: {s.effort}</span>
                  {s.resourceLinks.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 underline hover:text-purple-800"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ExpandableCheckCard({ check }: { check: CheckResult }) {
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
        {check.passed ? (
          <CheckCircleIcon className="size-5 shrink-0 text-green-600" />
        ) : (
          <XCircleIcon className="size-5 shrink-0 text-red-600" />
        )}
        <span className="font-medium">{check.name}</span>
      </AccordionTrigger>

      {check.detail && (
        <AccordionContent className="border-border border-t px-4 py-4">
          <CheckSummary check={check} />
        </AccordionContent>
      )}
    </AccordionItem>
  );
}

function CheckSummary({ check }: { check: CheckResult }) {
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

      <DetailBlock term="Issue" bold>
        {check.message}
      </DetailBlock>

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
            {check.detail.skillURL && (
              <Link
                to={check.detail.skillURL}
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
      </div>
    </div>
  );
}

function DetailBlock({
  term,
  children,
  bold,
}: {
  term: string;
  children: string;
  bold?: boolean;
}) {
  return (
    <div>
      <h4 className="text-foreground/70 mb-1 text-base font-semibold">
        {term}
      </h4>
      <p
        className={
          bold
            ? "text-foreground/80 text-base font-bold"
            : "text-foreground/80 text-base"
        }
      >
        {children}
      </p>
    </div>
  );
}
