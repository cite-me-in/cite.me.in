/**
 * Secrets are stored in Infisical. You need to run `infisical init` to
 * connect the current repository to Infisical.
 *
 * Project is built using Colima, Docker, and Docker Buildx. You need to install
 * Colima and Docker. Colima server is started automatically if it is not running.
 *
 * The Docker image is then pushed to GHCR. You need to make sure you have read
 * and read/write permissions to the repository. You need to provide the image name.
 *
 * Finally, the deployment is triggered on Coolify. You need to provide the
 * Coolify URL of your server and the Coolify app UUID.
 *
 * Example:
 * tsx scripts/lib/deploy.ts \
 *   --coolify-url https://coolify.labnotes.org \
 *   --image ghcr.io/cite-me-in/cite.me.in:latest \
 *   --app-uuid myp73fab3pizwxq1coahwxqw
 */

import { spawn } from "node:child_process";

const SPINNER_CHARS = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";

const colors = {
  green: "\x1b[0;32m",
  red: "\x1b[0;31m",
  cyan: "\x1b[0;36m",
  reset: "\x1b[0m",
};

if (import.meta.main) {
  deploy().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export async function deploy(): Promise<void> {
  const { coolifyURL, image, appName } = parseArgs();

  const envVars = await getRunTimeSecrets("prod");
  const token = await getCoolifyToken(coolifyURL);
  const appUUID = await findAppUUID({ coolifyURL, appName, token });

  const cleanup = await ensureColimaRunning();
  try {
    await buildDockerImage({ image, envVars });
    const deploymentUUID = await startDeployment({
      appUUID,
      token,
      coolifyURL,
    });
    await pollDeploymentStatus({
      deploymentUUID,
      token,
      coolifyURL,
      timeout: 600,
    });
  } finally {
    await cleanup();
  }
}

/**
 * Parses the command line arguments and returns the application name, Coolify
 * URL, and image name.
 */
function parseArgs(): {
  appName: string;
  coolifyURL: string;
  image: string;
} {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      `Missing required arguments:
  --coolify <Coolify URL>
  --app <Coolify application Name>
  --image <GHCR image name>`,
    );
    process.exit(1);
  }

  const result: any = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const argName = args[i].replace(/^--/, "");
      const value = args[i + 1];
      if (!value || value.startsWith("--"))
        throw new Error(`Missing value for argument: --${argName}`);
      result[argName.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      i++; // skip value
    }
  }

  if (!result.coolify)
    throw new Error("Missing required argument: --coolify <Coolify URL>");
  if (!result.app)
    throw new Error(
      "Missing required argument: --app <Coolify application Name>",
    );
  if (!result.image)
    throw new Error("Missing required argument: --image <GHCR image name>");
  return {
    coolifyURL: result.coolify as string,
    image: result.image as string,
    appName: result.app as string,
  };
}

/**
 * Gets the Coolify token from the Coolify context list. It looks for the
 * Coolify instance with the given Coolify URL and returns the token for that
 * instance.
 *
 * @param coolifyURL - The Coolify URL to get the token for.
 * @returns The Coolify token.
 * @throws {Error} If the Coolify instance is not found.
 */
async function getCoolifyToken(coolifyURL: string): Promise<string> {
  const response = JSON.parse(
    await runCommand(
      "coolify",
      "context",
      "list",
      "--show-sensitive",
      "--format",
      "json",
    ),
  ) as {
    name: string;
    fqdn: string;
    token: string;
  }[];
  try {
    const instance = response.find(
      ({ fqdn }) => new URL(coolifyURL).hostname === new URL(fqdn).hostname,
    );
    if (!instance) throw new Error("Not found");
    return instance.token;
  } catch {
    throw new Error(
      `Coolify instance not found\nAvailable instances: ${response.map(({ fqdn }) => fqdn).join(", ")}`,
    );
  }
}

/**
 * Ensures that Colima is running. It starts Colima if it is not running. It
 * also returns a function that stops Colima if it was not running before the
 * function was called.
 *
 * @returns A function that stops Colima if it was not running before the
 * function was called.
 */
async function ensureColimaRunning(): Promise<() => Promise<void>> {
  const wasRunning = await runCommand("colima", "status")
    .then(() => true)
    .catch(() => false);

  if (!wasRunning) {
    console.info("Starting colima...");
    await runCommand("colima", "start");
  }

  return async () => {
    if (!wasRunning) {
      console.info("Stopping colima...");
      await runCommand("colima", "stop");
    }
  };
}

/**
 * Gets the environment variables from Infisical. It runs the `infisical export`
 * command and returns the output as a string.
 *
 * @param env - The environment to get the secrets for.
 * @returns The environment variables.
 * @throws {Error} If the environment variables are not found.
 */
async function getRunTimeSecrets(env: string): Promise<string> {
  try {
    return runCommand("infisical", "export", "--env", env, "--format=dotenv");
  } catch {
    throw new Error(
      "Failed to get environment variables from Infisical, please run `infisical init` first",
    );
  }
}

/**
 * Builds and pushes the Docker image to the registry.
 *
 * @param image - The image name to push.
 * @param envVars - The environment variables to use for the build.
 * @returns A promise that resolves when the image is pushed.
 */
async function buildDockerImage({
  image,
  envVars,
}: {
  image: string;
  envVars: string;
}): Promise<void> {
  console.info("Building Docker image...");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "buildx",
        "build",
        "--platform",
        "linux/amd64",
        "--secret",
        "id=dotenv,src=/dev/stdin",
        "--push",
        "-t",
        image,
        ".",
      ],
      { stdio: ["pipe", "inherit", "inherit"] },
    );

    child.stdin?.write(envVars);
    child.stdin?.end();

    child.on("close", (code) => {
      if (code === 0) resolve();
      else {
        const cmd = `docker buildx build --platform linux/amd64 --secret id=dotenv,src=/dev/stdin --push -t ${image} .`;
        reject(new Error(`Command failed with code ${code}: ${cmd}`));
      }
    });

    child.on("error", reject);
  });
}

/**
 * Finds the application UUID for the given Coolify application name.
 *
 * @param coolifyURL - The Coolify URL to find the application for.
 * @param appName - The name of the application to find.
 * @param token - The Coolify token to use for authentication.
 * @returns The application UUID.
 */
async function findAppUUID({
  coolifyURL,
  appName,
  token,
}: {
  coolifyURL: string;
  appName: string;
  token: string;
}): Promise<string> {
  const url = new URL("/api/v1/applications", coolifyURL);
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok)
    throw new Error(`Failed to find application: ${response.statusText}`);
  const data = (await response.json()) as { uuid: string; name: string }[];
  try {
    const appUUID = data.find(({ name }) => name === appName)?.uuid;
    if (!appUUID) throw new Error("Not found");
    return appUUID;
  } catch {
    throw new Error(
      `No application found\nAvailable applications: ${data.map(({ name }) => name).join(", ")}`,
    );
  }
}

async function startDeployment({
  appUUID,
  token,
  coolifyURL,
}: {
  appUUID: string;
  token: string;
  coolifyURL: string;
}): Promise<string> {
  console.info("Starting deployment...");

  const url = new URL("/api/v1/deploy", coolifyURL);
  url.searchParams.set("type", "application");
  url.searchParams.set("uuid", appUUID);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok)
    throw new Error(`Failed to trigger deployment: ${response.statusText}`);

  const { deployments } = (await response.json()) as {
    deployments: { deployment_uuid: string }[] | undefined;
  };
  const deploymentUUID = deployments?.[0]?.deployment_uuid;
  if (!deploymentUUID) throw new Error("No deployment UUID in response");
  return deploymentUUID;
}

async function pollDeploymentStatus({
  deploymentUUID,
  token,
  coolifyURL,
  timeout,
}: {
  deploymentUUID: string;
  token: string;
  coolifyURL: string;
  timeout: number;
}): Promise<void> {
  console.info("Monitoring deployment status...");

  const startTime = Date.now();
  const timeoutMs = timeout * 1000;
  while (true) {
    const url = new URL(`/api/v1/deployments/${deploymentUUID}`, coolifyURL);
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok)
      throw new Error(
        `Failed to get deployment status: ${response.statusText}`,
      );

    const data = (await response.json()) as { status?: string };
    const status = data.status ?? "unknown";

    if (status === "finished" || status === "success") {
      console.info(
        `\r${colors.green}✓ Deployment completed successfully${colors.reset}\n`,
      );
      return;
    }

    if (status === "failed" || status === "error") {
      console.info(`\r${colors.red}✗ Deployment failed${colors.reset}\n`);
      throw new Error(
        `Deployment failed with status: ${status}\n${JSON.stringify(data, null, 2)}`,
      );
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= timeoutMs) {
      console.info(
        `\r${colors.red}✗ Deployment timed out after ${timeout} seconds${colors.reset}\n`,
      );
      throw new Error(
        `Deployment timed out with status: ${status}\n${JSON.stringify(data, null, 2)}`,
      );
    }

    const spinnerIndex = Math.floor((elapsed / 100) % SPINNER_CHARS.length);
    console.info(
      `\r${colors.cyan}${SPINNER_CHARS[spinnerIndex]}${colors.reset} Waiting for deployment...`,
    );

    await new Promise((resolve) => setTimeout(resolve, 3_000)); // 3 seconds
  }
}

function runCommand(command: string, ...args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data;
    });

    child.stderr?.on("data", (data) => {
      stderr += data;
    });

    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Command failed with code ${code}: ${stderr}`));
    });

    child.on("error", reject);
  });
}
