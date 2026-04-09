import { ms } from "convert";
import { CheckIcon, ClipboardCopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";

export default function TrackingScript({ script }: { script: string }) {
  const [copiedScript, setCopiedScript] = useState(false);

  function copyScriptToClipboard() {
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), ms("3s"));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracking Script</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-foreground/70 text-sm">
          Use this tracking script to track bot visits to your site.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Tracking Script</h3>
            <Button
              className={copiedScript ? "bg-green-500" : ""}
              onClick={copyScriptToClipboard}
              size="sm"
              type="button"
              variant="secondary"
            >
              {copiedScript ? (
                <CheckIcon className="size-4" />
              ) : (
                <ClipboardCopyIcon className="size-4" />
              )}
              Copy script
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-base border-2 border-black bg-[hsl(60,100%,99%)] p-4 font-mono text-xs leading-relaxed">
            {script}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
