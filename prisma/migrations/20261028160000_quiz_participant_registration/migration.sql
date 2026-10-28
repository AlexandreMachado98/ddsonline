-- Matrícula opcional para preservar as tentativas históricas.
ALTER TABLE "QuizAttempt" ADD COLUMN IF NOT EXISTS "participantRegistration" TEXT;
CREATE INDEX IF NOT EXISTS "QuizAttempt_participantRegistration_idx" ON "QuizAttempt"("participantRegistration");
