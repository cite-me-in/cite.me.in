import { logger } from "@sentry/react-router";
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { format, styleText } from "node:util";

const colors = {
  trace: (text: string) => styleText("gray", text),
  debug: (text: string) => styleText("blue", text),
  log: (text: string) => styleText("red", text),
  info: (text: string) => styleText("green", text),
  warn: (text: string) => styleText("yellow", text),
  error: (text: string) => styleText("red", text),
};

const logFile = import.meta.env.TEST
  ? createWriteStream(resolve("server.log"), { flags: "a" })
  : null;

// @see https://no-color.org
const isColorEnabled = !process.env.NO_COLOR;

for (const level of ["debug", "error", "info", "log", "trace", "warn"]) {
  const logtailFunction = Reflect.get(logger, level);
  const colorCode = colors[level as keyof typeof colors];

  Reflect.set(console, level, (message: string, ...metadata: unknown[]) => {
    const formattedMessage = format(message, ...metadata);

    process.stdout.write(
      isColorEnabled
        ? `${colorCode(formattedMessage)}\n`
        : `${formattedMessage}\n`,
    );

    try {
      if (logtailFunction)
        logtailFunction.call(logger, formattedMessage, ...metadata);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      process.stderr.write(`${errorMessage}\n`);
    }

    if (logFile) logFile.write(`${formattedMessage}\n`);
  });
}
