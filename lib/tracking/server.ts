import { createHash, randomBytes } from "node:crypto";

export function generateTrackedLinkSlug() {
  return randomBytes(7).toString("base64url");
}

export function hashClickIp(ipAddress: string | null | undefined) {
  if (!ipAddress) return null;

  const salt = process.env.NEXTAUTH_SECRET ?? "campaigncue-click-salt";
  return createHash("sha256").update(`${salt}:${ipAddress}`).digest("hex");
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    null
  );
}

const RECIPIENT_KEY_PATTERN = /^[a-f0-9]{16}$/;

/**
 * Anonymous, stable key for one DM recipient, appended to tracked links as
 * ?r= so clicks can be counted per person. It is a hash, so the Instagram user
 * id never appears in a URL.
 */
export function recipientKeyFor(userId: string | null | undefined) {
  if (!userId) return null;
  const salt = process.env.NEXTAUTH_SECRET ?? "campaigncue-click-salt";
  return createHash("sha256")
    .update(`${salt}:recipient:${userId}`)
    .digest("hex")
    .slice(0, 16);
}

export function parseRecipientKey(value: string | null | undefined) {
  return value && RECIPIENT_KEY_PATTERN.test(value) ? value : null;
}
