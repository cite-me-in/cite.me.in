import { describe, expect, it } from "vite-plus/test";
import {
  InsufficientCreditError,
  isInsufficientCreditError,
} from "~/lib/llm-visibility/insufficientCreditError";

describe("InsufficientCreditError", () => {
  it("should have correct name and message", () => {
    const error = new InsufficientCreditError("chatgpt", 402);
    expect(error.name).toBe("InsufficientCreditError");
    expect(error.message).toBe("chatgpt: insufficient credit (HTTP 402)");
    expect(error.platform).toBe("chatgpt");
    expect(error.statusCode).toBe(402);
  });

  it("should be detectable by isInsufficientCreditError", () => {
    const error = new InsufficientCreditError("claude", 429);
    expect(isInsufficientCreditError(error)).toBe(true);
  });

  it("should return false for non-InsufficientCreditError", () => {
    expect(isInsufficientCreditError(new Error("test"))).toBe(false);
    expect(isInsufficientCreditError(null)).toBe(false);
    expect(isInsufficientCreditError(undefined)).toBe(false);
  });
});
