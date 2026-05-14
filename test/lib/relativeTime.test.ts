import { describe, expect, it } from "vite-plus/test";
import { timeago } from "~/lib/relativeTime";

const NOW = new Date("2025-06-15T12:00:00Z").getTime();

describe("timeago", () => {
  it('returns "just now" for < 45 seconds', () => {
    expect(timeago(NOW, NOW)).toBe("just now");
    expect(timeago(NOW - 44000, NOW)).toBe("just now");
  });

  it('returns "1 minute ago" for 45-90 seconds in past', () => {
    expect(timeago(NOW - 60000, NOW)).toBe("1 minute ago");
  });

  it('returns "in 1 minute" for 45-90 seconds in future', () => {
    expect(timeago(NOW + 60000, NOW)).toBe("in 1 minute");
  });

  it("returns minutes for 90s-45min in past", () => {
    expect(timeago(NOW - 300000, NOW)).toBe("5 minutes ago");
  });

  it("returns minutes for 90s-45min in future", () => {
    expect(timeago(NOW + 300000, NOW)).toBe("in 5 minutes");
  });

  it('returns "1 hour ago" for 45-90 min in past', () => {
    expect(timeago(NOW - 3600000, NOW)).toBe("1 hour ago");
  });

  it("returns hours for 90min-22h in past", () => {
    expect(timeago(NOW - 7200000, NOW)).toBe("2 hours ago");
  });

  it("returns hours for 90min-22h in future", () => {
    expect(timeago(NOW + 7200000, NOW)).toBe("in 2 hours");
  });

  it('returns "1 day ago" for 22-36h in past', () => {
    expect(timeago(NOW - 86400000, NOW)).toBe("1 day ago");
  });

  it("returns days for 36h-26d in past", () => {
    expect(timeago(NOW - 172800000, NOW)).toBe("2 days ago");
  });

  it("returns days for 36h-26d in future", () => {
    expect(timeago(NOW + 172800000, NOW)).toBe("in 2 days");
  });

  it('returns "1 month ago" for 26-46d in past', () => {
    expect(timeago(NOW - 86400000 * 31, NOW)).toBe("1 month ago");
  });

  it("returns months for 46-320d", () => {
    expect(timeago(NOW - 86400000 * 150, NOW)).toBe("5 months ago");
  });

  it("caps months at 10 for values near 320 days", () => {
    expect(timeago(NOW - 86400000 * 319, NOW)).toBe("10 months ago");
  });

  it('returns "1 year ago" for 320-548d', () => {
    expect(timeago(NOW - 86400000 * 365, NOW)).toBe("1 year ago");
  });

  it("returns years for > 548d", () => {
    expect(timeago(NOW - 86400000 * 730, NOW)).toBe("2 years ago");
  });

  it("handles future years", () => {
    expect(timeago(NOW + 86400000 * 730, NOW)).toBe("in 2 years");
  });

  it("handles ISO 8601 string timestamps", () => {
    expect(timeago("2025-06-15T10:00:00Z", "2025-06-15T12:00:00Z")).toBe("2 hours ago");
  });

  it("uses timestamp as reference when omitted", () => {
    expect(timeago(NOW)).toBe("just now");
  });
});
