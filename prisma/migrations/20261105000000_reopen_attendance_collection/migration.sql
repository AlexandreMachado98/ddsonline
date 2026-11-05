ALTER TABLE "Meeting"
ADD COLUMN IF NOT EXISTS "attendanceCollectionOpen" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "AttendanceCollectionWindow" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openedById" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "AttendanceCollectionWindow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceCollectionWindow_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AttendanceCollectionWindow_meetingId_openedAt_idx"
ON "AttendanceCollectionWindow"("meetingId", "openedAt");
