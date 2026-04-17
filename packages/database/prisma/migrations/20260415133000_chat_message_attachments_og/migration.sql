-- Add attachments + OG preview metadata to messages.

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "attachments" jsonb,
  ADD COLUMN IF NOT EXISTS "link_preview" jsonb;

