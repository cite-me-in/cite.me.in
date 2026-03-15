import { Logtail } from "@logtail/node";
import { captureException as sentryCaptureException } from "@sentry/react-router";
import debug from "debug";
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
import type { Primitive } from "node_modules/zod/v3/helpers/typeAliases.cjs";
import envVars from "./envVars";

const logFile =
  process.env.NODE_ENV === "test" &&
  createWriteStream(resolve("server.log"), { flags: "a" });

const logger = debug("server");

const logtail =
  envVars.LOGTAIL_TOKEN &&
  envVars.LOGTAIL_ENDPOINT &&
  new Logtail(envVars.LOGTAIL_TOKEN, {
    endpoint: envVars.LOGTAIL_ENDPOINT,
    sendLogsToConsoleOutput: true,
    sendLogsToBetterStack: true,
  });

export default function logError(
  error: unknown,
  hints?: {
    user?: { id: string; email: string };
    extra?: Record<string, unknown>;
    tags?: {
      [key: string]: Primitive;
    };
  },
) {
  if (error instanceof Error) {
    logger(error.stack);
    if (logFile) logFile.write(`${error.stack}\n`);
  } else {
    logger(error);
    if (logFile) logFile.write(`${error}\n`);
  }

  sentryCaptureException(error, hints);

  if (logtail)
    logtail.error(
      error instanceof Error ? error.message : String(error),
      hints,
    );
}
