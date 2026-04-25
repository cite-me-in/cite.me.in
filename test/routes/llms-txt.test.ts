import { expect } from "playwright/test";
import { beforeAll, describe, it } from "vite-plus/test";
import { port } from "~/test/helpers/launchServer";

describe("llms.txt", () => {
  let content: string;

  beforeAll(async () => {
    const response = await fetch(`http://localhost:${port}/llms.txt`);
    content = await response.text();
  });

  it("should exist and return 200", async () => {
    const response = await fetch(`http://localhost:${port}/llms.txt`);
    expect(response.ok).toBe(true);
  });

  it("should have the project name as heading", () => {
    expect(content).toContain("# cite.me.in");
  });

  it("should mention the core value proposition", () => {
    expect(content).toMatch(/AI.*citation/i);
  });
});
