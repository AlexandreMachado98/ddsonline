-- DDS Semanal: questionário por tema (copiado para o DDS do tema quando ele abre).
-- Idempotente.
ALTER TABLE "DdsScheduleTheme" ADD COLUMN IF NOT EXISTS "quizSourceId" TEXT;
