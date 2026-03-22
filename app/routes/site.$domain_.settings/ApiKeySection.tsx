import { ms } from "convert";
import { CheckIcon, ClipboardCopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";

export default function ApiKeySection({
  apiKey,
  script,
}: {
  apiKey: string;
  script: string;
}) {
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  function copyApiKeyToClipboard() {
    navigator.clipboard.writeText(apiKey);
    setCopiedApiKey(true);
    setCopiedScript(false);
    setTimeout(() => setCopiedApiKey(false), ms("3s"));
  }

  function copyScriptToClipboard() {
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setCopiedApiKey(false);
    setTimeout(() => setCopiedScript(false), ms("3s"));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Key</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-foreground/70 text-sm">
          Use this API key to authenticate bot visit tracking requests from your
          server.
        </p>

        <div className="flex items-center gap-3">
          <code className="flex-1 rounded-base border-2 border-black bg-[hsl(60,100%,99%)] px-4 py-2 font-mono text-sm">
            {apiKey}
          </code>
          <Button
            className={copiedApiKey ? "bg-green-500" : ""}
            onClick={copyApiKeyToClipboard}
            size="sm"
            type="button"
            variant="secondary"
          >
            {copiedApiKey ? (
              <CheckIcon className="size-4" />
            ) : (
              <ClipboardCopyIcon className="size-4" />
            )}
            Copy
          </Button>
        </div>

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
