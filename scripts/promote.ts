#!/usr/bin/env tsx

/**
 * Use this to promote the latest deployment to production:
 *
 * pnpm promote
 */

import { confirm } from "@inquirer/prompts";
import { Vercel } from "@vercel/sdk";
import type { GetDeploymentResponseBody } from "@vercel/sdk/models/getdeploymentop.js";
import type { GetDeploymentsResponseBody } from "@vercel/sdk/models/getdeploymentsop.js";
import dotenv from "dotenv";
import envVars from "env-var";
import { invariant } from "es-toolkit";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Octokit } from "octokit";
import ora from "ora";
import { timeago } from "../app/lib/relativeTime";

dotenv.config({ quiet: true });

const teamId = envVars.get("VERCEL_ORG_ID").required(true).asString();
const projectId = envVars.get("VERCEL_PROJECT_ID").required(true).asString();
const vercel = new Vercel({
  bearerToken: envVars.get("VERCEL_TOKEN").required(true).asString(),
});
const octokit = new Octokit({
  auth: envVars.get("GITHUB_TOKEN").required(true).asString(),
});

const colorCodes: { [key: string]: [string, string] } = {
  red: ["\x1b[31m", "\x1b[0m"],
  green: ["\x1b[32m", "\x1b[0m"],
  yellow: ["\x1b[33m", "\x1b[0m"],
  blue: ["\x1b[34m", "\x1b[0m"],
  magenta: ["\x1b[35m", "\x1b[0m"],
  cyan: ["\x1b[36m", "\x1b[0m"],
  gray: ["\x1b[90m", "\x1b[0m"],
  bold: ["\x1b[1m", "\x1b[0m"],
};

/**
 * Adds ANSI color codes to a string of text.
 * @param text - The input string.
 * @param color - The color to apply. Options: 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'gray', 'bold', or undefined (no color).
 * @returns Colored string for terminal output.
 */
function colorize(color: keyof typeof colorCodes, text: string): string {
  if (!color || !colorCodes[color]) return text;
  const [open, close] = colorCodes[color];
  return `${open}${text}${close}`;
}

/**
 * Check if there are uncommitted changes in local git.
 * Exits with an error if there are uncommitted files.
 */
async function checkIfUncommittedChanges() {
  const status = await promisify(execFile)("git", ["status", "--porcelain"]);
  if (status.stdout.trim().length > 0)
    console.warn(
      "%s %s %s\n",
      colorize("yellow", "\u26A0 You have uncommitted changes. Please"),
      colorize("blue", "git commit"),
      colorize("yellow", "before promoting."),
    );
}

/**
 * Check if local Git is ahead of origin/main.
 * Exits with an error if there are commits ahead.
 */
async function checkIfGitAhead() {
  // Fetch latest from origin
  await promisify(execFile)("git", ["fetch", "origin", "main"]);

  const result = await promisify(execFile)("git", [
    "rev-list",
    "--left-right",
    "--count",
    "origin/main...HEAD",
  ]);
  const ahead = result.stdout.trim().split("\t")[1];
  if (ahead && Number(ahead) > 0)
    console.warn(
      "%s %s %s\n",
      colorize("yellow", "\u26A0 Local Git is ahead of origin/main. Please"),
      colorize("blue", "git push"),
      colorize("yellow", "before promoting."),
    );
}

/**
 * Check the status of the GitHub workflow.
 * Warns if the workflow is still building.
 */
async function githubWorkflows() {
  console.info(colorize("blue", "GitHub workflow status:"));

  console.info(
    "%s  %s  %s    %s",
    "  Created At".padEnd(15),
    "Commit".padEnd(10),
    "Title".padEnd(60),
    "Conclusion",
  );

  const { data } = await octokit.rest.actions.listWorkflowRuns({
    owner: "cite-me-in",
    repo: "cite.me.in",
    workflow_id: "deploy.yml",
  });
  for (const workflow of data.workflow_runs.slice(0, 5)) {
    const status = "%s  (%s)  %s => %s";
    console.info(
      workflow.conclusion === "failure"
        ? colorize("red", `✗ ${status}`)
        : workflow.conclusion === "success"
          ? colorize("green", `✓ ${status}`)
          : colorize("yellow", `⚡${status}`),
      timeago(workflow.created_at, Date.now()).padEnd(15),
      workflow.head_commit?.id.slice(-8),
      (
        workflow.display_title.slice(0, 59) +
        (workflow.display_title.length >= 60 ? "…" : "")
      ).padEnd(60),
      workflow.conclusion ?? "building…",
    );
  }

  if (!data.workflow_runs[0].conclusion) {
    console.error(
      colorize(
        "red",
        "\n\u26A0 GitHub workflow is still building. Please wait for it to complete before promoting.",
      ),
    );
  }

  console.info();
}

/**
 * Get the most recent deployment from Vercel.
 * Returns the deployment with the most recent createdAt timestamp.
 */
async function getRecentDeployment(): Promise<
  GetDeploymentsResponseBody["deployments"][0]
> {
  console.info(colorize("blue", "Vercel deployments:"));

  const { deployments } = await vercel.deployments.getDeployments({
    projectId,
    teamId,
    limit: 5,
  });

  console.info(
    "%s  %s  %s %s",
    "  Created At".padEnd(15),
    "Commit".padEnd(10),
    "URL".padEnd(61),
    "   Target",
  );

  for (const deployment of deployments) {
    const status = "%s  (%s)  %s => %s";
    console.info(
      deployment.state === "READY"
        ? colorize("green", `✓ ${status}`)
        : deployment.state === "BUILDING"
          ? colorize("yellow", `⚡${status}`)
          : colorize("red", `✗ ${status}`),
      timeago(deployment.createdAt ?? "", Date.now()).padEnd(15),
      deployment.meta?.githubCommitSha?.slice(-8),
      `https://${deployment.url}`.padEnd(61),
      deployment.target ?? "preview",
    );
  }
  console.info();

  const mostRecentDeployment = deployments[0];
  return mostRecentDeployment;
}

/**
 * Promote a deployment to production.
 * Creates a new deployment with the same name and URL as the current deployment.
 * Waits for the deployment to be ready.
 * Returns the deployment.
 */
async function promoteToProduction(
  deployment: GetDeploymentsResponseBody["deployments"][0],
): Promise<GetDeploymentResponseBody> {
  console.info(
    colorize("blue", "\n⏳ Promoting deployment %s to production...\n"),
    deployment.uid,
  );
  invariant(deployment.target === null, "Deployment is already in production");

  const { id } = await vercel.deployments.createDeployment({
    slug: deployment.name,
    teamId,
    requestBody: {
      deploymentId: deployment.uid,
      name: deployment.url,
      project: projectId,
      target: "production",
    },
  });
  return await waitForDeploy(id);
}

/**
 * Wait for a deployment to be ready.
 * Returns the deployment.
 */
async function waitForDeploy(
  idOrUrl: string,
): Promise<GetDeploymentResponseBody> {
  console.info(colorize("blue", "Waiting for deployment to be ready..."));
  const spinner = ora().start();

  while (true) {
    const status = await vercel.deployments.getDeployment({ idOrUrl });
    if (status.readyState === "ERROR") throw new Error("Deployment failed");
    if (status.readyState === "CANCELED")
      throw new Error("Deployment was canceled");

    const isPromoted =
      status.readySubstate === "PROMOTED" && status.target === "production";
    if (isPromoted) {
      spinner.succeed("Deployment is ready");
      console.info(
        colorize("blue", "Try it out: %s"),
        `https://${status.alias?.[0] ?? status.url}`,
      );
      return status;
    }

    spinner.text = `${status.readySubstate || status.readyState}…`;
  }
}

/**
 * Interactive mode.
 * Checks for uncommitted changes, Git ahead, GitHub workflow status, and Vercel deployment status.
 * Promotes the deployment to production if it is not in production.
 */
async function interactive() {
  // Check if local Git is ahead of origin/main
  await checkIfUncommittedChanges();
  await checkIfGitAhead();
  // Review GitHub workflow status
  await githubWorkflows();
  // Review Vercel deployment status
  const mostRecent = await getRecentDeployment();
  const isInProduction = mostRecent.target === "production";

  if (isInProduction) {
    await waitForDeploy(mostRecent.uid);
  } else {
    const isReady = mostRecent.readyState === "READY";
    if (isReady) {
      const gitId = mostRecent.meta?.githubCommitSha?.slice(-8);
      console.info(
        colorize("blue", "Try it out: %s"),
        `https://${mostRecent.url}`,
      );
      const shouldPromote = await confirm({
        default: false,
        message: `Promote deployment ${gitId} to production?`,
      });
      if (shouldPromote) await promoteToProduction(mostRecent);
      else {
        console.error(
          colorize("red", "\n✘ Deployment not promoted to production"),
        );
        process.exit(1);
      }
    } else {
      console.error(
        colorize(
          "red",
          "\n✘ Deployment is not ready. Please wait for it to be ready before promoting.",
        ),
      );
      process.exit(1);
    }
  }

  await promisify(execFile)("open", ["--background", "https://cite.me.in"]);
  await promisify(execFile)("terminal-notifier", [
    "-message",
    "Browser opened to cite.me.in",
    "-title",
    "Promoted to Production",
    "-open",
    "https://cite.me.in",
    "-contentImage",
    "https://cite.me.in/icon-192.png",
  ]);
  process.exit(0);
}

// Run the interactive mode
await interactive();
