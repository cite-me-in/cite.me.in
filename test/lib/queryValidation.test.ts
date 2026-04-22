import { describe, expect, it } from "vite-plus/test";
import {
  hasWordChanges,
  isMeaningfulSentence,
} from "~/lib/llm-visibility/queryValidation";

describe("isMeaningfulSentence", () => {
  it("should return true for a full question", () => {
    expect(isMeaningfulSentence("what is the best weather app?")).toBe(true);
  });
  it("should return true for a short 3-word query", () => {
    expect(isMeaningfulSentence("best weather app")).toBe(true);
  });
  it("should return false for empty string", () => {
    expect(isMeaningfulSentence("")).toBe(false);
  });
  it("should return false for a single word", () => {
    expect(isMeaningfulSentence("weather")).toBe(false);
  });
  it("should return false for two words", () => {
    expect(isMeaningfulSentence("weather app")).toBe(false);
  });
  it("should return false for punctuation only", () => {
    expect(isMeaningfulSentence("??? !!!")).toBe(false);
  });
});

describe("hasWordChanges", () => {
  it("should return false when only punctuation differs", () => {
    expect(hasWordChanges("weather app?", "weather app!")).toBe(false);
  });
  it("should return false when only whitespace differs", () => {
    expect(hasWordChanges("weather  app", "weather app")).toBe(false);
  });
  it("should return false when only case differs", () => {
    expect(hasWordChanges("Weather App", "weather app")).toBe(false);
  });
  it("should return true when a word is replaced", () => {
    expect(hasWordChanges("best weather app", "best weather tool")).toBe(true);
  });
  it("should return true when a word is added", () => {
    expect(hasWordChanges("weather app", "best weather app")).toBe(true);
  });
  it("should return true when a word is removed", () => {
    expect(hasWordChanges("best weather app", "weather app")).toBe(true);
  });
});
