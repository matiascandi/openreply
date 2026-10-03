-- Clicks used to be counted per tap, so CTR divided raw taps by DM sends and a
-- person who got several messages (opening DM, follow prompt, link) dragged it
-- down. Each DM link now carries an anonymous per-recipient key, stored here so
-- clicks can be counted per person.
ALTER TABLE "LinkClick" ADD COLUMN IF NOT EXISTS "recipientKey" TEXT;

CREATE INDEX IF NOT EXISTS "LinkClick_automationId_recipientKey_idx" ON "LinkClick"("automationId", "recipientKey");
