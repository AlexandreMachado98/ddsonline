-- Idempotent reconciliation for attendance columns introduced in Prisma schema.
-- Preserve existing attendance data, signatures and quiz attempt relationships.
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "registration" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "quizProofHash" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "exitReason" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "exitSignature" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "leftAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Attendance_meetingId_createdAt_idx"
  ON "Attendance"("meetingId", "createdAt");
