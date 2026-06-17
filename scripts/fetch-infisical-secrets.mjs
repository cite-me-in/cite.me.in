#!/usr/bin/env node

/**
 * Fetch secrets from Infisical via the REST API and print as dotenv-export format.
 *
 * Designed to be called from `child_process.execSync` in vite.config.ts.
 * No CLI login required — uses Machine Identity (Universal Auth).
 * Falls back to empty output silently if credentials aren't configured.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_ID = "a89716e5-9232-4ee7-85ea-11977924fe95";
const INFISICAL_API = "https://app.infisical.com/api";

function readCredentials() {
  const envId = process.env.INFISICAL_CLIENT_ID;
  const envSecret = process.env.INFISICAL_CLIENT_SECRET;
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret };

  try {
    const configPath = join(
      homedir(),
      ".config",
      "infisical",
      "credentials.json",
    );
    const raw = readFileSync(configPath, "utf-8");
    const creds = JSON.parse(raw);
    if (creds.clientId && creds.clientSecret)
      return { clientId: creds.clientId, clientSecret: creds.clientSecret };
  } catch {
    // No config file
  }
  return null;
}

async function main() {
  const creds = readCredentials();
  if (!creds) return;

  try {
    // 1. Authenticate
    const authRes = await fetch(
      `${INFISICAL_API}/v1/auth/universal-auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!authRes.ok) return;
    const { accessToken } = await authRes.json();

    // 2. List secrets for the test environment
    const secretsRes = await fetch(
      `${INFISICAL_API}/v4/secrets?environment=test&projectId=${PROJECT_ID}&viewSecretValue=true&expandSecretReferences=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!secretsRes.ok) return;
    const { secrets } = await secretsRes.json();

    // 3. Print as dotenv-export format
    for (const s of secrets) {
      const value = s.secretValue ?? "";
      if (/[\s'"$\\]/.test(value)) {
        process.stdout.write(
          `export ${s.secretKey}=${JSON.stringify(value)}\n`,
        );
      } else {
        process.stdout.write(`export ${s.secretKey}=${value}\n`);
      }
    }
  } catch {
    // Network error or timeout — fall back silently
  }
}

void main();
