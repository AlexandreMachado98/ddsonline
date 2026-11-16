-- DDS Semanal (link fixo): programações, semanas e temas.
-- Idempotente: pode ser executado mais de uma vez sem erro.

CREATE TABLE IF NOT EXISTS "DdsSchedule" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "farm" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT,
    "organizerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DdsSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DdsScheduleWeek" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DdsScheduleWeek_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DdsScheduleTheme" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "objective" TEXT,
    "programmaticContent" TEXT,
    "durationHours" INTEGER NOT NULL DEFAULT 24,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "reopenUntil" TIMESTAMP(3),
    "meetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DdsScheduleTheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DdsSchedule_slug_key" ON "DdsSchedule"("slug");

CREATE INDEX IF NOT EXISTS "DdsSchedule_organizerId_idx" ON "DdsSchedule"("organizerId");

CREATE INDEX IF NOT EXISTS "DdsSchedule_companyId_idx" ON "DdsSchedule"("companyId");

CREATE INDEX IF NOT EXISTS "DdsScheduleWeek_scheduleId_startsAt_idx" ON "DdsScheduleWeek"("scheduleId", "startsAt");

CREATE UNIQUE INDEX IF NOT EXISTS "DdsScheduleTheme_meetingId_key" ON "DdsScheduleTheme"("meetingId");

CREATE INDEX IF NOT EXISTS "DdsScheduleTheme_opensAt_idx" ON "DdsScheduleTheme"("opensAt");

CREATE UNIQUE INDEX IF NOT EXISTS "DdsScheduleTheme_weekId_order_key" ON "DdsScheduleTheme"("weekId", "order");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DdsSchedule_companyId_fkey') THEN
    ALTER TABLE "DdsSchedule" ADD CONSTRAINT "DdsSchedule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DdsSchedule_organizerId_fkey') THEN
    ALTER TABLE "DdsSchedule" ADD CONSTRAINT "DdsSchedule_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DdsScheduleWeek_scheduleId_fkey') THEN
    ALTER TABLE "DdsScheduleWeek" ADD CONSTRAINT "DdsScheduleWeek_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "DdsSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DdsScheduleTheme_weekId_fkey') THEN
    ALTER TABLE "DdsScheduleTheme" ADD CONSTRAINT "DdsScheduleTheme_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "DdsScheduleWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DdsScheduleTheme_meetingId_fkey') THEN
    ALTER TABLE "DdsScheduleTheme" ADD CONSTRAINT "DdsScheduleTheme_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
