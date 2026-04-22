import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { format, styleText } from "node:util";
import { Logtail } from "@logtail/node";
import { logger as sentry } from "@sentry/react-router";
import debug from "debug";
import envVars from "./envVars.server";

const colors = {
  trace: (text: string) => styleText("gray", text),
  debug: (text: string) => styleText("blue", text),
  log: (text: string) => styleText("red", text),
  info: (text: string) => styleText("green", text),
  warn: (text: string) => styleText("yellow", text),
  error: (text: string) => styleText("red", text),
};

const logFile =
  process.env.NODE_ENV === "test"
    ? createWriteStream(resolve("server.log"), { flags: "a" })
    : null;

const logtail =
  envVars.LOGTAIL_TOKEN &&
  envVars.LOGTAIL_ENDPOINT &&
  new Logtail(envVars.LOGTAIL_TOKEN, {
    endpoint: envVars.LOGTAIL_ENDPOINT,
    sendLogsToConsoleOutput: false,
    sendLogsToBetterStack: true,
  });

// @see https://no-color.org
const isColorEnabled = !process.env.NO_COLOR;

for (const level of ["debug", "error", "info", "log", "trace", "warn"]) {
  const sentryFunction = Reflect.get(sentry, level);
  const logtailFunction = logtail && Reflect.get(logtail, level);
  const colorCode = colors[level as keyof typeof colors];

  Reflect.set(console, level, (message: string, ...metadata: unknown[]) => {
    const formattedMessage = format(message, ...metadata);
    if (logFile) logFile.write(`${formattedMessage}\n`);

    process.stdout.write(
      isColorEnabled
        ? `${colorCode(formattedMessage)}\n`
        : `${formattedMessage}\n`,
    );

    try {
      if (sentryFunction)
        sentryFunction.call(sentry, formattedMessage, ...metadata);
      if (logtailFunction)
        logtailFunction
          .call(logtail, formattedMessage, ...metadata)
          .catch(() => {});
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      process.stderr.write(`${errorMessage}\n`);
    }
  });
}

// Override debug.log to use console.log so we get the same general benefits
debug.log = console.info;
