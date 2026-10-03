const SKIPPED_PREFIX = "SKIPPED_";

export interface StatusCountRow {
  status: string;
  _count: number | { status?: number; _all?: number };
}

export interface KeywordCountRow {
  matchedKeyword: string | null;
  _count: number | { matchedKeyword?: number; _all?: number };
}

function getCount(value: StatusCountRow["_count"] | KeywordCountRow["_count"]) {
  if (typeof value === "number") return value;
  if ("status" in value && typeof value.status === "number") {
    return value.status;
  }
  if ("matchedKeyword" in value && typeof value.matchedKeyword === "number") {
    return value.matchedKeyword;
  }
  return value._all ?? 0;
}

export function calculateCtr(clicks: number, sent: number) {
  if (sent <= 0) return 0;
  // Raw clicks can exceed sends (repeat clicks, link-preview bots hitting the
  // tracked URL), which makes a "rate" over 100% — cap it so CTR stays sane.
  return Math.min(100, Number(((clicks / sent) * 100).toFixed(1)));
}

export function summarizeDmStatuses(rows: StatusCountRow[]) {
  return rows.reduce(
    (summary, row) => {
      const count = getCount(row._count);
      if (row.status === "SENT") summary.sent += count;
      if (row.status === "FAILED") summary.failed += count;
      if (row.status.startsWith(SKIPPED_PREFIX)) summary.skipped += count;
      return summary;
    },
    { sent: 0, skipped: 0, failed: 0 }
  );
}

export function normalizeTopKeywords(rows: KeywordCountRow[], limit = 5) {
  return rows
    .filter((row) => row.matchedKeyword)
    .map((row) => ({
      keyword: row.matchedKeyword as string,
      count: getCount(row._count),
    }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, limit);
}

export interface ClickIdentityRow {
  id: string;
  recipientKey: string | null;
  ipHash: string | null;
}

/**
 * Number of distinct people behind a set of clicks. Tagged links (?r=) carry a
 * per-recipient key; clicks from before tagging, or from a link opened without
 * it, fall back to the hashed IP, and only then to the click itself.
 */
export function countUniqueClickers(rows: ClickIdentityRow[]) {
  const people = new Set<string>();
  for (const row of rows) {
    if (row.recipientKey) people.add(`r:${row.recipientKey}`);
    else if (row.ipHash) people.add(`ip:${row.ipHash}`);
    else people.add(`click:${row.id}`);
  }
  return people.size;
}

/**
 * Per-person funnel: how many distinct people got a DM from the campaign, and
 * how many of them went on to open the link. CTR is completed ÷ people, so a
 * person who received several messages counts once.
 */
export function summarizeFunnel(people: number, completed: number) {
  const done = Math.min(completed, people);
  return { people, completed: done, ctr: calculateCtr(done, people) };
}
