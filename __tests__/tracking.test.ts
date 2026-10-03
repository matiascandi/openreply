import { describe, expect, it } from "vitest";
import {
  calculateCtr,
  normalizeTopKeywords,
  summarizeDmStatuses,
} from "../lib/tracking/analytics";
import {
  buildTrackedUrl,
  extractFirstUrl,
  renderMessageWithTracking,
  replaceUrlWithTrackedPlaceholder,
} from "../lib/tracking/message";

describe("tracked link messages", () => {
  it("extracts a destination URL and replaces it with the tracked placeholder", () => {
    const message =
      "Hey {username}, here is your guide: https://example.com/guide.";
    const url = extractFirstUrl(message);

    expect(url).toBe("https://example.com/guide");
    expect(replaceUrlWithTrackedPlaceholder(message, url)).toBe(
      "Hey {username}, here is your guide: {link}."
    );
  });

  it("renders tracked URLs with username personalization", () => {
    expect(
      renderMessageWithTracking({
        message: "Hey {username}, grab it here: {link}",
        commenterName: "Maya",
        trackedLinks: [
          {
            slug: "abc123",
            destinationUrl: "https://example.com/guide",
          },
        ],
        baseUrl: "https://manychat-alternative.com",
      })
    ).toBe("Hey Maya, grab it here: https://manychat-alternative.com/r/abc123");
  });

  it("can replace a raw destination URL when the placeholder is missing", () => {
    expect(
      renderMessageWithTracking({
        message: "Link: https://example.com/guide",
        trackedLinks: [
          {
            slug: "abc123",
            destinationUrl: "https://example.com/guide",
          },
        ],
        baseUrl: "https://manychat-alternative.com/",
      })
    ).toBe("Link: https://manychat-alternative.com/r/abc123");
  });

  it("matches normalized root URLs with or without trailing slash", () => {
    expect(
      replaceUrlWithTrackedPlaceholder("Link: https://example.com", "https://example.com/")
    ).toBe("Link: {link}");
    expect(
      renderMessageWithTracking({
        message: "Link: https://example.com",
        trackedLinks: [
          {
            slug: "abc123",
            destinationUrl: "https://example.com/",
          },
        ],
        baseUrl: "https://manychat-alternative.com",
      })
    ).toBe("Link: https://manychat-alternative.com/r/abc123");
  });

  it("builds redirect URLs from a base URL", () => {
    expect(buildTrackedUrl("abc123", "https://manychat-alternative.com/")).toBe(
      "https://manychat-alternative.com/r/abc123"
    );
  });
});

describe("campaign analytics helpers", () => {
  it("summarizes DM status rows", () => {
    expect(
      summarizeDmStatuses([
        { status: "SENT", _count: 20 },
        { status: "FAILED", _count: 2 },
        { status: "SKIPPED_RATE_LIMIT", _count: 3 },
        { status: "SKIPPED_PLAN_LIMIT", _count: 1 },
      ])
    ).toEqual({ sent: 20, skipped: 4, failed: 2 });
  });

  it("calculates CTR and handles empty send volume", () => {
    expect(calculateCtr(5, 20)).toBe(25);
    expect(calculateCtr(2, 3)).toBe(66.7);
    expect(calculateCtr(5, 0)).toBe(0);
  });

  it("normalizes top keywords by count", () => {
    expect(
      normalizeTopKeywords([
        { matchedKeyword: "PRICE", _count: 3 },
        { matchedKeyword: null, _count: 9 },
        { matchedKeyword: "LINK", _count: 7 },
      ])
    ).toEqual([
      { keyword: "LINK", count: 7 },
      { keyword: "PRICE", count: 3 },
    ]);
  });
});

import {
  countUniqueClickers,
  summarizeFunnel,
} from "../lib/tracking/analytics";
import { parseRecipientKey, recipientKeyFor } from "../lib/tracking/server";
import { buildTrackedUrl as buildUrl } from "../lib/tracking/message";

describe("per-person funnel", () => {
  it("counts a person once however many times they click", () => {
    expect(
      countUniqueClickers([
        { id: "1", recipientKey: "aaaaaaaaaaaaaaaa", ipHash: "x" },
        { id: "2", recipientKey: "aaaaaaaaaaaaaaaa", ipHash: "y" },
        { id: "3", recipientKey: null, ipHash: "z" },
        { id: "4", recipientKey: null, ipHash: "z" },
        { id: "5", recipientKey: null, ipHash: null },
      ])
    ).toBe(3);
  });

  it("computes CTR as people who clicked over people DMed, capped", () => {
    expect(summarizeFunnel(1, 1)).toEqual({ people: 1, completed: 1, ctr: 100 });
    expect(summarizeFunnel(3, 2)).toEqual({ people: 3, completed: 2, ctr: 66.7 });
    expect(summarizeFunnel(1, 4)).toEqual({ people: 1, completed: 1, ctr: 100 });
    expect(summarizeFunnel(0, 0)).toEqual({ people: 0, completed: 0, ctr: 0 });
  });

  it("tags tracked URLs with a stable, anonymous recipient key", () => {
    const key = recipientKeyFor("17841400000000000");
    expect(key).toMatch(/^[a-f0-9]{16}$/);
    expect(recipientKeyFor("17841400000000000")).toBe(key);
    expect(key).not.toContain("1784140");
    expect(buildUrl("abc", "https://x.app", key)).toBe(`https://x.app/r/abc?r=${key}`);
    expect(buildUrl("abc", "https://x.app")).toBe("https://x.app/r/abc");
    expect(parseRecipientKey(key)).toBe(key);
    expect(parseRecipientKey("not-a-key")).toBeNull();
  });
});
