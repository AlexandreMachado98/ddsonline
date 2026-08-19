-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "farm" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "selfie" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meetingId" TEXT NOT NULL,
    CONSTRAINT "Attendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
