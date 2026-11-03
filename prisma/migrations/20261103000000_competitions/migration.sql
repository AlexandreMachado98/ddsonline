-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompetitionEventType" AS ENUM ('DDS_ATTENDANCE', 'QUIZ_PARTICIPATION', 'QUIZ_PERFORMANCE');

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "registration" TEXT;

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "ddsAttendancePoints" INTEGER NOT NULL DEFAULT 10,
    "quizParticipationPoints" INTEGER NOT NULL DEFAULT 5,
    "quizPerformancePoints" INTEGER NOT NULL DEFAULT 1,
    "companyId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionEvent" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "type" "CompetitionEventType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "participantRegistration" TEXT NOT NULL,
    "participantName" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompetitionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competition_companyId_status_startDate_endDate_idx" ON "Competition"("companyId", "status", "startDate", "endDate");
CREATE INDEX "Competition_organizerId_createdAt_idx" ON "Competition"("organizerId", "createdAt");
CREATE UNIQUE INDEX "CompetitionEvent_competitionId_type_sourceId_key" ON "CompetitionEvent"("competitionId", "type", "sourceId");
CREATE INDEX "CompetitionEvent_competitionId_participantRegistration_idx" ON "CompetitionEvent"("competitionId", "participantRegistration");
CREATE INDEX "CompetitionEvent_competitionId_createdAt_idx" ON "CompetitionEvent"("competitionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetitionEvent" ADD CONSTRAINT "CompetitionEvent_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
