-- Add speed bonus to competition scoring. Existing competitions receive the default 5-point bonus.
ALTER TYPE "CompetitionEventType" ADD VALUE IF NOT EXISTS 'QUIZ_SPEED';
ALTER TABLE "Competition" ADD COLUMN IF NOT EXISTS "quizSpeedPoints" INTEGER NOT NULL DEFAULT 5;
