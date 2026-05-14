import { describe, expect, it } from "vite-plus/test";
import ts from "typescript";
import {
  assertDefaultExport,
  boolExport,
  collect,
  parseConvertCall,
  strExport,
  timeoutExport,
} from "~/lib/cron/loadTasks";

function makeSource(content: string): ts.SourceFile {
  return ts.createSourceFile("test.ts", content, ts.ScriptTarget.Latest, true);
}

describe("collect", () => {
  it("parses a file with exported const strings, numbers, booleans", () => {
    const source = makeSource(`
      export const foo = "hello";
      export const bar = 42;
      export const baz = true;
    `);
    const map = collect(source);
    expect(map.size).toBe(3);
    expect(map.get("foo")?.strValue).toBe("hello");
    expect(map.get("bar")?.text).toBe("42");
    expect(map.get("baz")?.kind).toBe(ts.SyntaxKind.TrueKeyword);
  });

  it("collects only exported variable statements", () => {
    const source = makeSource(`
      const foo = "hello";
      export const bar = "world";
    `);
    const map = collect(source);
    expect(map.size).toBe(1);
    expect(map.get("bar")?.strValue).toBe("world");
    expect(map.has("foo")).toBe(false);
  });

  it("skips statements without initializers", () => {
    const source = makeSource(`
      export const x: string;
      export const y = "ok";
    `);
    const map = collect(source);
    expect(map.size).toBe(1);
    expect(map.get("y")?.strValue).toBe("ok");
  });

  it("handles template literals", () => {
    const source = makeSource("export const x = `hello`;");
    const map = collect(source);
    expect(map.get("x")?.strValue).toBe("hello");
  });

  it("handles non-string initializers", () => {
    const source = makeSource("export const x = 42;");
    const map = collect(source);
    expect(map.get("x")?.strValue).toBeUndefined();
    expect(map.get("x")?.text).toBe("42");
  });
});

describe("strExport", () => {
  it("returns string value when entry exists and is a string literal", () => {
    const map = new Map([
      ["name", { kind: ts.SyntaxKind.StringLiteral, text: '"hello"', strValue: "hello" }],
    ]);
    expect(strExport(map, "name")).toBe("hello");
  });

  it("throws when entry doesn't exist", () => {
    const map = new Map();
    expect(() => strExport(map, "missing")).toThrow("app/cron/: missing export const missing");
  });

  it("throws when entry exists but has no strValue", () => {
    const map = new Map([
      ["num", { kind: ts.SyntaxKind.NumericLiteral, text: "42", strValue: undefined }],
    ]);
    expect(() => strExport(map, "num")).toThrow(
      "app/cron/: export const num must be a string literal",
    );
  });
});

describe("boolExport", () => {
  it("returns true for TrueKeyword entry", () => {
    const map = new Map([
      ["flag", { kind: ts.SyntaxKind.TrueKeyword, text: "true", strValue: undefined }],
    ]);
    expect(boolExport(map, "flag", false)).toBe(true);
  });

  it("returns false for FalseKeyword entry", () => {
    const map = new Map([
      ["flag", { kind: ts.SyntaxKind.FalseKeyword, text: "false", strValue: undefined }],
    ]);
    expect(boolExport(map, "flag", true)).toBe(false);
  });

  it("returns defaultVal when entry not found", () => {
    const map = new Map();
    expect(boolExport(map, "missing", true)).toBe(true);
    expect(boolExport(map, "missing", false)).toBe(false);
  });

  it("throws when entry exists but is not a boolean", () => {
    const map = new Map([
      ["str", { kind: ts.SyntaxKind.StringLiteral, text: '"hello"', strValue: "hello" }],
    ]);
    expect(() => boolExport(map, "str", false)).toThrow(
      "app/cron/: export const str must be a boolean literal",
    );
  });
});

describe("timeoutExport", () => {
  it('parses "30s" to 30', () => {
    const map = new Map([
      ["timeout", { kind: ts.SyntaxKind.StringLiteral, text: '"30s"', strValue: "30s" }],
    ]);
    expect(timeoutExport(map)).toBe(30);
  });

  it('parses "5m" to 300', () => {
    const map = new Map([
      ["timeout", { kind: ts.SyntaxKind.StringLiteral, text: '"5m"', strValue: "5m" }],
    ]);
    expect(timeoutExport(map)).toBe(300);
  });

  it('parses "1h" to 3600', () => {
    const map = new Map([
      ["timeout", { kind: ts.SyntaxKind.StringLiteral, text: '"1h"', strValue: "1h" }],
    ]);
    expect(timeoutExport(map)).toBe(3600);
  });

  it('parses "90" (no unit) to 90', () => {
    const map = new Map([
      ["timeout", { kind: ts.SyntaxKind.StringLiteral, text: '"90"', strValue: "90" }],
    ]);
    expect(timeoutExport(map)).toBe(90);
  });

  it("throws on invalid timeout string", () => {
    const map = new Map([
      ["timeout", { kind: ts.SyntaxKind.StringLiteral, text: '"abc"', strValue: "abc" }],
    ]);
    expect(() => timeoutExport(map)).toThrow('Invalid timeout string: "abc"');
  });

  it('handles convert(10, "minutes").to("seconds") pattern', () => {
    const map = new Map([
      [
        "timeout",
        {
          kind: ts.SyntaxKind.CallExpression,
          text: 'convert(10, "minutes").to("seconds")',
          strValue: undefined,
        },
      ],
    ]);
    expect(timeoutExport(map)).toBe(600);
  });

  it('handles convert(2, "hours").to("seconds")', () => {
    const map = new Map([
      [
        "timeout",
        {
          kind: ts.SyntaxKind.CallExpression,
          text: 'convert(2, "hours").to("seconds")',
          strValue: undefined,
        },
      ],
    ]);
    expect(timeoutExport(map)).toBe(7200);
  });

  it("throws on invalid convert call pattern", () => {
    const map = new Map([
      [
        "timeout",
        {
          kind: ts.SyntaxKind.CallExpression,
          text: 'convert(10, "days").to("seconds")',
          strValue: undefined,
        },
      ],
    ]);
    expect(() => timeoutExport(map)).toThrow(
      'Invalid timeout: "convert(10, "days").to("seconds")"',
    );
  });

  it("throws when timeout is missing from the map", () => {
    const map = new Map();
    expect(() => timeoutExport(map)).toThrow("app/cron/: missing export const timeout");
  });
});

describe("parseConvertCall", () => {
  it('parses convert(10, "minutes").to("seconds") to 600', () => {
    expect(parseConvertCall('convert(10, "minutes").to("seconds")')).toBe(600);
  });

  it('parses convert(2, "hours").to("seconds") to 7200', () => {
    expect(parseConvertCall('convert(2, "hours").to("seconds")')).toBe(7200);
  });

  it("returns null for non-matching strings", () => {
    expect(parseConvertCall("30")).toBeNull();
    expect(parseConvertCall("convert(10)")).toBeNull();
    expect(parseConvertCall('convert(10, "minutes")')).toBeNull();
  });
});

describe("assertDefaultExport", () => {
  it("passes for file with export default function", () => {
    const source = makeSource("export default function foo() {}");
    expect(() => assertDefaultExport(source)).not.toThrow();
  });

  it("passes for file with export default class", () => {
    const source = makeSource("export default class Foo {}");
    expect(() => assertDefaultExport(source)).not.toThrow();
  });

  it("passes for file with export default expression", () => {
    const source = makeSource("export default 42;");
    expect(() => assertDefaultExport(source)).not.toThrow();
  });

  it("throws for file with no default export", () => {
    const source = makeSource("export const foo = 1;");
    expect(() => assertDefaultExport(source)).toThrow(
      "app/cron/: file does not export a default function",
    );
  });

  it("throws for empty file", () => {
    const source = makeSource("");
    expect(() => assertDefaultExport(source)).toThrow(
      "app/cron/: file does not export a default function",
    );
  });
});
