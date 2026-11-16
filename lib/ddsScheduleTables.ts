// lib/ddsScheduleTables.ts
// Cria as tabelas do DDS Semanal se ainda não existirem (mesmo SQL da migração
// 20261116000000_dds_weekly_schedule). Roda uma vez por instância do servidor.

import prisma from '@/lib/prisma';

const STATEMENTS: string[] = [
  "CREATE TABLE IF NOT EXISTS \"DdsSchedule\" (\n    \"id\" TEXT NOT NULL,\n    \"slug\" TEXT NOT NULL,\n    \"name\" TEXT NOT NULL,\n    \"farm\" TEXT NOT NULL,\n    \"active\" BOOLEAN NOT NULL DEFAULT true,\n    \"companyId\" TEXT,\n    \"organizerId\" TEXT NOT NULL,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"DdsSchedule_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"DdsScheduleWeek\" (\n    \"id\" TEXT NOT NULL,\n    \"scheduleId\" TEXT NOT NULL,\n    \"startsAt\" TIMESTAMP(3) NOT NULL,\n    \"endsAt\" TIMESTAMP(3) NOT NULL,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"DdsScheduleWeek_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"DdsScheduleTheme\" (\n    \"id\" TEXT NOT NULL,\n    \"weekId\" TEXT NOT NULL,\n    \"order\" INTEGER NOT NULL,\n    \"topic\" TEXT NOT NULL,\n    \"objective\" TEXT,\n    \"programmaticContent\" TEXT,\n    \"durationHours\" INTEGER NOT NULL DEFAULT 24,\n    \"opensAt\" TIMESTAMP(3) NOT NULL,\n    \"closesAt\" TIMESTAMP(3) NOT NULL,\n    \"reopenUntil\" TIMESTAMP(3),\n    \"meetingId\" TEXT,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"DdsScheduleTheme_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"DdsSchedule_slug_key\" ON \"DdsSchedule\"(\"slug\")",
  "CREATE INDEX IF NOT EXISTS \"DdsSchedule_organizerId_idx\" ON \"DdsSchedule\"(\"organizerId\")",
  "CREATE INDEX IF NOT EXISTS \"DdsSchedule_companyId_idx\" ON \"DdsSchedule\"(\"companyId\")",
  "CREATE INDEX IF NOT EXISTS \"DdsScheduleWeek_scheduleId_startsAt_idx\" ON \"DdsScheduleWeek\"(\"scheduleId\", \"startsAt\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"DdsScheduleTheme_meetingId_key\" ON \"DdsScheduleTheme\"(\"meetingId\")",
  "CREATE INDEX IF NOT EXISTS \"DdsScheduleTheme_opensAt_idx\" ON \"DdsScheduleTheme\"(\"opensAt\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"DdsScheduleTheme_weekId_order_key\" ON \"DdsScheduleTheme\"(\"weekId\", \"order\")",
  "DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DdsSchedule_companyId_fkey') THEN\n    ALTER TABLE \"DdsSchedule\" ADD CONSTRAINT \"DdsSchedule_companyId_fkey\" FOREIGN KEY (\"companyId\") REFERENCES \"Company\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;\n  END IF;\nEND $$",
  "DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DdsSchedule_organizerId_fkey') THEN\n    ALTER TABLE \"DdsSchedule\" ADD CONSTRAINT \"DdsSchedule_organizerId_fkey\" FOREIGN KEY (\"organizerId\") REFERENCES \"User\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE;\n  END IF;\nEND $$",
  "DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DdsScheduleWeek_scheduleId_fkey') THEN\n    ALTER TABLE \"DdsScheduleWeek\" ADD CONSTRAINT \"DdsScheduleWeek_scheduleId_fkey\" FOREIGN KEY (\"scheduleId\") REFERENCES \"DdsSchedule\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;\n  END IF;\nEND $$",
  "DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DdsScheduleTheme_weekId_fkey') THEN\n    ALTER TABLE \"DdsScheduleTheme\" ADD CONSTRAINT \"DdsScheduleTheme_weekId_fkey\" FOREIGN KEY (\"weekId\") REFERENCES \"DdsScheduleWeek\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;\n  END IF;\nEND $$",
  "DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DdsScheduleTheme_meetingId_fkey') THEN\n    ALTER TABLE \"DdsScheduleTheme\" ADD CONSTRAINT \"DdsScheduleTheme_meetingId_fkey\" FOREIGN KEY (\"meetingId\") REFERENCES \"Meeting\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE;\n  END IF;\nEND $$"
];

let ready: Promise<boolean> | null = null;

// Colunas adicionadas depois da criação das tabelas (migrações posteriores).
const COLUMN_STATEMENTS: string[] = [
  'ALTER TABLE "DdsScheduleTheme" ADD COLUMN IF NOT EXISTS "quizSourceId" TEXT' // 20261117000000_dds_weekly_quiz
];

async function apply(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('DdsSchedule','DdsScheduleWeek','DdsScheduleTheme')`
  );
  if (rows[0]?.n !== 3) {
    await prisma.$transaction(STATEMENTS.map(sql => prisma.$executeRawUnsafe(sql)));
    console.info('Tabelas do DDS Semanal criadas automaticamente.');
  }
  await prisma.$transaction(COLUMN_STATEMENTS.map(sql => prisma.$executeRawUnsafe(sql)));
  return true;
}

/** Garante as tabelas do DDS Semanal. Nunca lança erro; em falha, tenta de novo na próxima chamada. */
export function ensureDdsScheduleTables(): Promise<boolean> {
  if (!ready) {
    ready = apply().catch(error => {
      console.error('Não foi possível criar as tabelas do DDS Semanal automaticamente:', error);
      ready = null;
      return false;
    });
  }
  return ready;
}
