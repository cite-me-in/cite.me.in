import { useCallback, useMemo, useState } from "react";

import buildPrompt from "./buildPrompt";
import type { CheckResult } from "./types";

/**
 * Shared hook for copy-to-clipboard prompt logic.
 * Used by ImproveScoreModal, ImproveSiteModal, and QuickWinCard.
 */
export default function useCopyPrompt(failedChecks: CheckResult[]) {
  const allPrompts = useMemo(
    () => failedChecks.map(buildPrompt).join("\n\n---\n\n"),
    [failedChecks],
  );
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(allPrompts);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [allPrompts]);

  return { allPrompts, copied, copy };
}
