import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vite-plus/test";
import { removeElements } from "~/lib/html/parseHTML";
import prisma from "~/lib/prisma.server";
import type { User } from "~/prisma";
import { goto } from "~/test/helpers/launchBrowser";
import { port } from "~/test/helpers/launchServer";
import { signIn } from "~/test/helpers/signIn";

const HOSTNAME = "citation-detail-test.com";
const QUERY_ID = "query-cite-detail-1";
const RUN_ID = "cite-detail-run-1";

const CITATIONS = [
  `https://${HOSTNAME}/about`,
  "https://competitor.com/blog/retail-spaces",
  "https://mallspace.com/listings",
];

const QUERY_TEXT = "Where can I find short-term retail space in malls?";
const RESPONSE_TEXT =
  "Short-term retail space in malls can be found through several platforms. **citation-detail-test.com** offers a marketplace for pop-up and kiosk leasing. You can also check competitor.com and mallspace.com for listings.";

describe("unauthenticated access", () => {
  it("should redirect to /sign-in", async () => {
    const response = await fetch(
      `http://localhost:${port}/site/${HOSTNAME}/citation/${QUERY_ID}`,
      {
        redirect: "manual",
      },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});

describe("single citation page", () => {
  let user: User;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: "user-cite-detail-1",
        email: "cite-detail-test@test.com",
        passwordHash: "test",
      },
    });
    const site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-cite-detail-1",
        content: "Test content",
        domain: HOSTNAME,
        id: "site-cite-detail-1",
        ownerId: user.id,
        summary: "Test summary",
      },
    });

    await prisma.citationQueryRun.create({
      data: {
        id: RUN_ID,
        siteId: site.id,
        platform: "chatgpt",
        model: "gpt-4o",
        onDate: "2026-02-26",
        queries: {
          create: {
            id: QUERY_ID,
            query: QUERY_TEXT,
            group: "1. discovery",
            text: RESPONSE_TEXT,
            extraQueries: [],
          },
        },
      },
    });

    await prisma.citation.createMany({
      data: CITATIONS.map((url) => ({
        url,
        domain: new URL(url).hostname,
        queryId: QUERY_ID,
        runId: RUN_ID,
        siteId: site.id,
      })),
      skipDuplicates: true,
    });
  });

  it("should show the query and platform info", async () => {
    await signIn(user.id);
    const page = await goto(`/site/${HOSTNAME}/citation/${QUERY_ID}`);
    await expect(page.getByText(`Q: ${QUERY_TEXT}`)).toBeVisible();
    await expect(
      page.getByText(/chatgpt · gpt-4o · 1\. discovery/),
    ).toBeVisible();
  });

  it("should list all citations with same-domain highlighted", async () => {
    await signIn(user.id);
    const page = await goto(`/site/${HOSTNAME}/citation/${QUERY_ID}`);
    for (const url of CITATIONS) {
      await expect(page.getByRole("link", { name: url })).toBeVisible();
    }
    // Same-domain row should have green background class
    const sameDomainLink = page.getByRole("link", {
      name: `https://${HOSTNAME}/about`,
    });
    const row = sameDomainLink.locator("xpath=ancestor::tr[1]");
    await expect(row).toHaveClass(/bg-green-100/);
  });

  it("should show the response text", async () => {
    await signIn(user.id);
    const page = await goto(`/site/${HOSTNAME}/citation/${QUERY_ID}`);
    await expect(page.getByText("gpt-4o")).toBeVisible();
    await expect(
      page.getByText(/Short-term retail space in malls/),
    ).toBeVisible();
  });

  it("should match visually", async () => {
    await signIn(user.id);
    const page = await goto(`/site/${HOSTNAME}/citation/${QUERY_ID}`);
    await expect(page.locator("main")).toMatchVisual({
      name: "site/citations.query",
      modify: (html) =>
        removeElements(html, (node) => {
          // Strip internal navigation links that contain dynamic paths
          const href = node.attributes.href ?? "";
          return href.startsWith("/site/");
        }),
    });
  });
});
