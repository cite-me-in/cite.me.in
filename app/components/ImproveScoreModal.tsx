import { ArrowBigUpDashIcon, CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button, type ButtonProps } from "~/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/Dialog";
import type { CheckResult } from "~/lib/aiLegibility/types";

function buildPrompt(check: CheckResult) {
  if (!check.detail) return "";
  const docs = check.detail.resourceLinks.map((l) => l.url).join(", ");
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

export default function ImproveScoreModal({
  failedChecks,
  size,
}: {
  size?: ButtonProps["size"];
  failedChecks: CheckResult[];
}) {
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
      <DialogTrigger>
        <Button variant="default" size={size}>
          <ArrowBigUpDashIcon className="size-4" />
          Improve your score
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[80vh] overflow-y-auto sm:max-w-2xl"
        data-state={open ? "open" : "closed"}
      >
        <DialogHeader>
          <DialogTitle>Improve your AI Legibility Score</DialogTitle>
          <DialogDescription>
            Use the prompt below with your coding agent to fix the issues found
            during the scan.
          </DialogDescription>
        </DialogHeader>

        <textarea
          className="border-border bg-secondary-background min-h-[300px] w-full rounded-base border-2 p-4 font-mono text-sm"
          value={allPrompts}
          readOnly
        />

        <div className="border-border flex items-center justify-between border-t pt-4">
          <span className="text-foreground/60 text-sm">
            {failedChecks.length} issue{failedChecks.length > 1 ? "s" : ""} to
            fix
          </span>
          <Button
            variant={copied ? "default" : "outline"}
            onClick={handleCopyAll}
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
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
