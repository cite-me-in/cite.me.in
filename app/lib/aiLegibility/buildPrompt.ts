import type { CheckResult } from "./types";

export default function buildPrompt(check: CheckResult) {
  if (!check.detail) return "";
  const docs = check.detail.resourceLinks.map((l) => l.url).join(", ");
  const parts = [
    `Goal: ${check.detail.goal}`,
    `Issue: ${check.message}`,
    `Fix: ${check.detail.howToImplement}`,
  ];
  if (check.detail.fixExample) parts.push(`Example:\n\`\`\`\n${check.detail.fixExample}\n\`\`\``);
  if (check.detail.skillURL) parts.push(`Skill: ${check.detail.skillURL}`);
  if (docs) parts.push(`Docs: ${docs}`);
  return parts.join("\n\n");
}
