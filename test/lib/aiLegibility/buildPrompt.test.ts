import { expect, it } from "vitest";
import buildPrompt from "~/lib/aiLegibility/buildPrompt";
import type { CheckResult } from "~/lib/aiLegibility/types";

const baseCheck: CheckResult = {
  name: "robots.txt",
  category: "welcomed",
  passed: false,
  message: "robots.txt blocks AI crawlers",
  detail: {
    goal: "Allow AI crawlers to access your site",
    issue: "AI agents respect robots.txt directives",
    howToImplement: "Add Allow rules for known AI bot user-agents",
    fixExample: "User-agent: GPTBot\nAllow: /",
    effort: "2 min",
    resourceLinks: [
      {
        label: "About robots.txt",
        url: "https://developers.google.com/search/docs/robots",
      },
    ],
    skillURL: "https://skills.sh/example/robots-txt",
  },
};

it("should include goal, issue, and fix", () => {
  const result = buildPrompt(baseCheck);
  expect(result).toContain("Goal: Allow AI crawlers to access your site");
  expect(result).toContain("Issue: robots.txt blocks AI crawlers");
  expect(result).toContain("Fix: Add Allow rules for known AI bot user-agents");
});

it("should include fixExample wrapped in code fence", () => {
  const result = buildPrompt(baseCheck);
  expect(result).toContain("Example:");
  expect(result).toContain("```");
  expect(result).toContain("User-agent: GPTBot\nAllow: /");
});

it("should include skillURL when present", () => {
  const result = buildPrompt(baseCheck);
  expect(result).toContain("Skill: https://skills.sh/example/robots-txt");
});

it("should include resource links when present", () => {
  const result = buildPrompt(baseCheck);
  expect(result).toContain("Docs: https://developers.google.com/search/docs/robots");
});

it("should skip skillURL and fixExample when absent", () => {
  const without: CheckResult = {
    ...baseCheck,
    detail: {
      ...baseCheck.detail!,
      fixExample: undefined,
      skillURL: undefined,
    },
  };
  const result = buildPrompt(without);
  expect(result).not.toContain("Example:");
  expect(result).not.toContain("Skill:");
});

it("should return empty string when check has no detail", () => {
  const noDetail: CheckResult = { ...baseCheck, detail: undefined };
  expect(buildPrompt(noDetail)).toBe("");
});

it("should join parts with double newline", () => {
  const result = buildPrompt(baseCheck);
  expect(result).toMatch(/\n\n/);
});
