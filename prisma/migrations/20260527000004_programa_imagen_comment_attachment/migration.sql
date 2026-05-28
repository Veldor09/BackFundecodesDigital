-- Phase 10: Add imagenUrl to ProgramaVoluntariado + attachmentUrl/Key to Comment

-- ProgramaVoluntariado cover image
ALTER TABLE "programa_voluntariado"
  ADD COLUMN IF NOT EXISTS "imagen_url" TEXT,
  ADD COLUMN IF NOT EXISTS "imagen_key" TEXT;

-- Comment attachment (image/video)
ALTER TABLE "Comment"
  ADD COLUMN IF NOT EXISTS "attachment_url" TEXT,
  ADD COLUMN IF NOT EXISTS "attachment_key" TEXT;
