import { Logtail } from "@logtail/node";
import { captureException as sentryCaptureException } from "@sentry/react-router";
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { format } from "node:util";
import type { Primitive } from "node_modules/zod/v3/helpers/typeAliases.cjs";
import envVars from "./envVars";

const logFile =
  process.env.NODE_ENV === "test" &&
  createWriteStream(resolve("server.log"), { flags: "a" });

const logtail =
  envVars.LOGTAIL_TOKEN &&
  envVars.LOGTAIL_ENDPOINT &&
  new Logtail(envVars.LOGTAIL_TOKEN, {
    endpoint: envVars.LOGTAIL_ENDPOINT,
    sendLogsToConsoleOutput: true,
    sendLogsToBetterStack: true,
  });

export default function captureException(
  error: unknown,
  hints?: {
    user?: { id: string; email: string };
    extra?: Record<string, unknown>;
    tags?: {
      [key: string]: Primitive;
    };
  },
) {
  const formattedMessage = format(
    error instanceof Error ? error.message : String(error),
    hints,
  );
  console.error(formattedMessage, hints);
  if (logFile) logFile.write(`${formattedMessage}\n`);
  sentryCaptureException(formattedMessage, hints);
  if (logtail) logtail.error(formattedMessage, hints);
}
