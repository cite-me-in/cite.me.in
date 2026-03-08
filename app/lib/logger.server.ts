import { Logtail } from "@logtail/node";
import { logger as sentry } from "@sentry/react-router";
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { format, styleText } from "node:util";
import envVars from "./envVars";

const colors = {
  trace: (text: string) => styleText("gray", text),
  debug: (text: string) => styleText("blue", text),
  log: (text: string) => styleText("red", text),
  info: (text: string) => styleText("green", text),
  warn: (text: string) => styleText("yellow", text),
  error: (text: string) => styleText("red", text),
};

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

// @see https://no-color.org
const isColorEnabled = !process.env.NO_COLOR;

for (const level of ["debug", "error", "info", "log", "trace", "warn"]) {
  const sentryFunction = Reflect.get(sentry, level);
  const logtailFunction = logtail && Reflect.get(logtail, level);
  const colorCode = colors[level as keyof typeof colors];

  Reflect.set(console, level, (message: string, ...metadata: unknown[]) => {
    const formattedMessage = format(message, ...metadata);

    process.stdout.write(
      isColorEnabled
        ? `${colorCode(formattedMessage)}\n`
        : `${formattedMessage}\n`,
    );

    try {
      if (sentryFunction)
        sentryFunction.call(sentry, formattedMessage, ...metadata);
      if (logtailFunction)
        logtailFunction.call(logtail, formattedMessage, ...metadata);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      process.stderr.write(`${errorMessage}\n`);
    }

    if (logFile) logFile.write(`${formattedMessage}\n`);
  });
}
