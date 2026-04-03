import { createWriteStream } from "node:fs";
import { Logtail } from "@logtail/node";
import { resolve } from "node:path";
import {
  captureException as sentryCaptureException,
  type ExclusiveEventHintOrCaptureContext,
} from "@sentry/react-router";
import envVars from "./envVars.server";
import debug from "debug";

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

export default function captureAndLogError(
  error: unknown,
  hints?: ExclusiveEventHintOrCaptureContext,
) {
  sentryCaptureException(error, hints);

  if (error instanceof Error) {
    // Only log stack trace lines that include 'loader' or 'action'
    const stack = error.stack
      ?.split("\n")
      .filter(
        (line) =>
          /\.pnpm\/react-router@[\d.]/i.test(line) ||
          line.trim().toLowerCase().startsWith("error"),
      )
      .join("\n");
    logger(stack);
    console.error(stack);
    if (logFile) logFile.write(`${error.stack}\n`);
    if (logtail) logtail.error(error.message, hints).catch(() => {});
  } else {
    logger(error);
    console.error(error);
    if (logFile) logFile.write(`${error}\n`);
    if (logtail) logtail.error(String(error), hints).catch(() => {});
  }
}
