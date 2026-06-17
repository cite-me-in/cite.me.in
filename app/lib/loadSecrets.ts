import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Infisical workspace ID for the cite.me.in project.
 */
const PROJECT_ID = "a89716e5-9232-4ee7-85ea-11977924fe95";

const INFISICAL_API = "https://app.infisical.com/api";

function readCredentials(): { clientId: string; clientSecret: string } | null {
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
    const creds = JSON.parse(raw) as {
      clientId?: string;
      clientSecret?: string;
    };
    if (creds.clientId && creds.clientSecret)
      return { clientId: creds.clientId, clientSecret: creds.clientSecret };
  } catch {
    // No config file — that's fine
  }

  return null;
}

/**
 * Fetch secrets from Infisical via the REST API.
 *
 * Uses Universal Auth (Machine Identity) to authenticate.
 * Falls back silently if credentials aren't configured — callers
 * will use whatever is already in process.env.
 */
async function loadInfisicalEnv(): Promise<Record<string, string>> {
  const creds = readCredentials();
  if (!creds) return {};

  const INFISICAL_TIMEOUT = 10_000;
  const abort = AbortSignal.timeout(INFISICAL_TIMEOUT);

  try {
    // 1. Authenticate with Machine Identity (Universal Auth)
    const authRes = await fetch(
      `${INFISICAL_API}/v1/auth/universal-auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
        signal: abort,
      },
    );

    if (!authRes.ok) {
      const body = await authRes.text();
      console.warn(`Infisical auth failed (${authRes.status}): ${body}`);
      return {};
    }

    const { accessToken } = (await authRes.json()) as { accessToken: string };

    // 2. List all secrets for the test environment
    const secretsRes = await fetch(
      `${INFISICAL_API}/v4/secrets?environment=test&projectId=${PROJECT_ID}&viewSecretValue=true&expandSecretReferences=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: abort,
      },
    );

    if (!secretsRes.ok) {
      const body = await secretsRes.text();
      console.warn(
        `Infisical secrets fetch failed (${secretsRes.status}): ${body}`,
      );
      return {};
    }

    const { secrets } = (await secretsRes.json()) as {
      secrets: Array<{ secretKey: string; secretValue: string }>;
    };

    const env: Record<string, string> = {};
    for (const s of secrets) env[s.secretKey] = s.secretValue;
    return env;
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.warn("Infisical API timed out — falling back to process.env");
    }
    return {};
  }
}

/**
 * Load secrets from Infisical into process.env (in place).
 *
 * Existing values in process.env take precedence, so CLI overrides or
 * .env files still work.
 */
export async function loadInfisicalIntoEnv(): Promise<void> {
  const secrets = await loadInfisicalEnv();
  for (const [key, value] of Object.entries(secrets))
    if (!(key in process.env)) process.env[key] = value;
}
