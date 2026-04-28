import { toPng } from "html-to-image";
import { Loader2Icon, Share2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/Button";

export default function ShareButton({
  scoreCardRef,
}: {
  scoreCardRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={async () => {
        const el = scoreCardRef.current;
        if (!el) return;
        setLoading(true);
        try {
          const dataUrl = await toPng(el, { quality: 1, pixelRatio: 2 });
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], "ai-legibility-score.png", {
            type: "image/png",
          });
          if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: "AI Legibility Score",
              files: [file],
            });
          } else {
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = "ai-legibility-score.png";
            a.click();
          }
        } catch {
          // user cancelled share or fallback
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <Share2Icon className="size-4" />
      )}
      Share
    </Button>
  );
}
