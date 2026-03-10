import { CheckIcon } from "lucide-react";
import { useState } from "react";
import AuthForm from "~/components/ui/AuthForm";
import { Button } from "~/components/ui/Button";
import { requireUser } from "~/lib/auth.server";
import envVars from "~/lib/envVars";
import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Your Account | CiteUp" },
    { name: "description", content: "Manage your account settings." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const script = `
const tracker = createBotTracker({
  apiKey: "${user.account.apiKey}",
  endpoint: "${envVars.BOT_TRACKER_URL.toString()}",
});

function requestHandler(request) {
  // fire-and-forget, production only
  if (import.meta.env.PROD) tracker.track(request);
  …
}
  `.trim();
  return { script, apiKey: user.account.apiKey };
}

export default function AccountRoute({ loaderData }: Route.ComponentProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(loaderData.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AuthForm
      className="w-full max-w-2xl"
      title="Your account"
      form={
        <div className="space-y-4">
          <p>Your account API key is:</p>
          <p className="font-bold font-mono text-lg">{loaderData.apiKey}</p>
          <p>
            Copy and paste this code into your website's HTML file to track bot
            traffic.
          </p>
          <pre className="rounded-base bg-gray-100 p-4 font-mono text-base">
            {loaderData.script}
          </pre>
          <Button onClick={handleCopy} variant="secondary">
            {copied && <CheckIcon className="size-4" />}
            {copied ? "Copied!" : "Copy to clipboard"}
          </Button>
        </div>
      }
    />
  );
}
