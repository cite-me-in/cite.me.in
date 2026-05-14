import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import invariant from "tiny-invariant";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const baseDir = resolve(__dirname, "../../__screenshots__");

export function getTestName(): string {
  const error = new Error();
  const stackLines = error.stack?.split("\n") || [];
  const callerLine = stackLines.find(
    (line) => line.includes(".test.") && !line.includes("node_modules"),
  );
  invariant(callerLine, "Could not determine test file name");
  const match = callerLine.match(/\/(.+?):\d+/);
  const testFile = match ? path.basename(match[1]) : "unknown";
  return testFile.replace(/\.test\.(ts|tsx)$/, "");
}
