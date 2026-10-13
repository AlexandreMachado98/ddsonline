-- DDS Online: módulo de avaliações. Executar via migração revisada, nunca automaticamente em produção.
CREATE TABLE "Quiz" (
  "id" TEXT PRIMARY KEY,
  "meetingId" TEXT NOT NULL REFERENCES "Meeting"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "passingScore" INTEGER NOT NULL DEFAULT 70,
  "criticalBelow" INTEGER NOT NULL DEFAULT 40,
  "excellentFrom" INTEGER NOT NULL DEFAULT 90,
  "shareToken" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "Quiz_score_limits" CHECK ("passingScore" BETWEEN 0 AND 100 AND "criticalBelow" BETWEEN 0 AND "passingScore" AND "excellentFrom" BETWEEN "passingScore" AND 100),
  CONSTRAINT "Quiz_status_valid" CHECK ("status" IN ('DRAFT','PUBLISHED','CLOSED'))
);
CREATE INDEX "Quiz_meetingId_idx" ON "Quiz"("meetingId");
CREATE TABLE "QuizQuestion" (
  "id" TEXT PRIMARY KEY,
  "quizId" TEXT NOT NULL REFERENCES "Quiz"("id") ON DELETE CASCADE,
  "text" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'SINGLE_CHOICE',
  "weight" INTEGER NOT NULL DEFAULT 1,
  "position" INTEGER NOT NULL,
  "explanation" TEXT,
  CONSTRAINT "QuizQuestion_weight_positive" CHECK ("weight" > 0)
);
CREATE INDEX "QuizQuestion_quizId_position_idx" ON "QuizQuestion"("quizId", "position");
CREATE TABLE "QuizOption" (
  "id" TEXT PRIMARY KEY,
  "questionId" TEXT NOT NULL REFERENCES "QuizQuestion"("id") ON DELETE CASCADE,
  "text" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT FALSE,
  "position" INTEGER NOT NULL
);
CREATE INDEX "QuizOption_questionId_position_idx" ON "QuizOption"("questionId", "position");
CREATE TABLE "QuizAttempt" (
  "id" TEXT PRIMARY KEY,
  "quizId" TEXT NOT NULL REFERENCES "Quiz"("id") ON DELETE CASCADE,
  "attendanceId" TEXT NOT NULL REFERENCES "Attendance"("id") ON DELETE CASCADE,
  "score" DOUBLE PRECISION NOT NULL,
  "earnedPoints" INTEGER NOT NULL,
  "possiblePoints" INTEGER NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "level" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizAttempt_unique" UNIQUE ("quizId", "attendanceId"),
  CONSTRAINT "QuizAttempt_score_range" CHECK ("score" BETWEEN 0 AND 100)
);
CREATE INDEX "QuizAttempt_quizId_submittedAt_idx" ON "QuizAttempt"("quizId", "submittedAt");
CREATE TABLE "QuizAnswer" (
  "id" TEXT PRIMARY KEY,
  "attemptId" TEXT NOT NULL REFERENCES "QuizAttempt"("id") ON DELETE CASCADE,
  "questionId" TEXT NOT NULL REFERENCES "QuizQuestion"("id") ON DELETE CASCADE,
  "selectedOptionIds" JSONB NOT NULL,
  "correct" BOOLEAN NOT NULL,
  "earnedPoints" INTEGER NOT NULL,
  CONSTRAINT "QuizAnswer_unique" UNIQUE ("attemptId", "questionId")
);
CREATE INDEX "QuizAnswer_attemptId_idx" ON "QuizAnswer"("attemptId");
