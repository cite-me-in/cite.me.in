import { Share2Icon } from "lucide-react";
import { Button } from "~/components/ui/Button";

export default function ShareButton({
  score,
  domain,
}: {
  score: number;
  domain: string;
}) {
  const shareData = {
    title: `AI Legibility Score: ${score}% for ${domain}`,
    text: `My site ${domain} scored ${score}% on AI Legibility. Check yours at`,
    url: `https://cite.me.in/site/${domain}/ai-legibility`,
  };

  return (
    <Button
      variant="outline"
      onClick={() => {
        if (navigator.share) {
          navigator.share(shareData);
        } else {
          navigator.clipboard.writeText(
            `${shareData.title}\n${shareData.url}`,
          );
        }
      }}
    >
      <Share2Icon className="size-4" />
      Share
    </Button>
  );
}
