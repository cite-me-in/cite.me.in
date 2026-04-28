import { ArrowBigUpDashIcon, CopyIcon } from "lucide-react";
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
  const count = failedChecks.length;

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="default" size={size}>
          <ArrowBigUpDashIcon className="size-4" />
          Improve the score{" "}
          <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-black/20 text-xs font-bold">
            {count}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Improve your AI Legibility Score</DialogTitle>
          <DialogDescription>
            Fix these {count} issue{count > 1 ? "s" : ""} to improve your score.
            Each issue includes a prompt you can paste into your coding agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {failedChecks.map((check, i) => (
            <div
              key={i}
              className="rounded-base border-2 border-red-300 bg-red-50 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">{check.name}</h3>
                  <p className="text-foreground/60 mt-1 text-sm">
                    {check.message}
                  </p>
                </div>
                {check.detail && (
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
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-border flex justify-end border-t pt-4">
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(allPrompts)}
          >
            <CopyIcon className="size-4" />
            Copy all instructions
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
