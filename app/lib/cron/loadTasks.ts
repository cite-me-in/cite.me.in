import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { CronTaskConfig } from "./types";

const cronDir = path.resolve("app/cron");

/**
 * Find all cron files in app/cron/ and extract their exports at the AST level.
 */
export async function loadCronTasks(): Promise<CronTaskConfig[]> {
  const entries = fs.readdirSync(cronDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => entry.name);

  return files.map((filename) => {
    const filePath = path.join(cronDir, filename);
    const name = filename.replace(/\.\w+$/, "");
    const content = fs.readFileSync(filePath, "utf-8");
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
    );

    const exports = collect(sourceFile);
    const schedule = strExport(exports, "schedule");
    const timeout = timeoutExport(exports);
    assertDefaultExport(sourceFile);

    return { name, schedule, timeout };
  });
}

interface Expr {
  kind: ts.SyntaxKind;
  text: string;
  strValue?: string;
}

function collect(sourceFile: ts.SourceFile): Map<string, Expr> {
  const map = new Map<string, Expr>();
  for (const stmt of sourceFile.statements) {
    if (
      !ts.isVariableStatement(stmt) ||
      !stmt.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)
    )
      continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const init = decl.initializer;
      const strValue = ts.isStringLiteral(init)
        ? init.text
        : ts.isNoSubstitutionTemplateLiteral(init)
          ? init.text
          : undefined;
      map.set(decl.name.text, {
        kind: init.kind,
        text: init.getText(sourceFile),
        strValue,
      });
    }
  }
  return map;
}

function strExport(map: Map<string, Expr>, name: string): string {
  const entry = map.get(name);
  if (!entry) throw new Error(`app/cron/: missing export const ${name}`);
  if (entry.strValue === undefined)
    throw new Error(`app/cron/: export const ${name} must be a string literal`);
  return entry.strValue;
}

function timeoutExport(map: Map<string, Expr>): number {
  const entry = map.get("timeout");
  if (!entry) throw new Error("app/cron/: missing export const timeout");

  if (entry.strValue !== undefined) {
    const match = entry.strValue.match(/^(\d+)\s*(s|m|h)?$/);
    if (!match) throw new Error(`Invalid timeout string: "${entry.strValue}"`);
    const value = parseInt(match[1], 10);
    const unit = match[2] ?? "s";
    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 3600;
    }
  }
  throw new Error(`Invalid timeout: "${entry.text}"`);
}

function assertDefaultExport(sourceFile: ts.SourceFile): void {
  for (const stmt of sourceFile.statements) {
    if (ts.isExportAssignment(stmt)) return;
    if (
      (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) &&
      stmt.modifiers?.some(
        (modifier) =>
          modifier.kind === ts.SyntaxKind.DefaultKeyword &&
          stmt.modifiers?.some((m2) => m2.kind === ts.SyntaxKind.ExportKeyword),
      )
    )
      return;
  }
  throw new Error("app/cron/: file does not export a default function");
}
