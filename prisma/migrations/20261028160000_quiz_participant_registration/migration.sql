-- Matrícula opcional para preservar as tentativas históricas.
ALTER TABLE "QuizAttempt" ADD COLUMN "participantRegistration" TEXT;
CREATE INDEX "QuizAttempt_participantRegistration_idx" ON "QuizAttempt"("participantRegistration");
