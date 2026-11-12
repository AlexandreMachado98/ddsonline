// lib/competitionBonusSchema.ts
// Garante que as tabelas de pontos extras da competição existam no banco.
// Equivale à migração 20261112000000_competition_bonus_points, mas é idempotente
// (IF NOT EXISTS) e roda automaticamente uma vez por instância do servidor.

import prisma from '@/lib/prisma';

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "CompetitionBonusCriterion" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompetitionBonusCriterion_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "CompetitionBonusEntry" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "participantRegistration" TEXT NOT NULL,
    "participantName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompetitionBonusEntry_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "CompetitionBonusCriterion_competitionId_createdAt_idx" ON "CompetitionBonusCriterion"("competitionId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "CompetitionBonusEntry_competitionId_participantRegistration_idx" ON "CompetitionBonusEntry"("competitionId", "participantRegistration")`,
  `CREATE INDEX IF NOT EXISTS "CompetitionBonusEntry_criterionId_idx" ON "CompetitionBonusEntry"("criterionId")`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompetitionBonusCriterion_competitionId_fkey') THEN
      ALTER TABLE "CompetitionBonusCriterion" ADD CONSTRAINT "CompetitionBonusCriterion_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompetitionBonusEntry_competitionId_fkey') THEN
      ALTER TABLE "CompetitionBonusEntry" ADD CONSTRAINT "CompetitionBonusEntry_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompetitionBonusEntry_criterionId_fkey') THEN
      ALTER TABLE "CompetitionBonusEntry" ADD CONSTRAINT "CompetitionBonusEntry_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "CompetitionBonusCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`
];

let ready: Promise<boolean> | null = null;

async function apply(): Promise<boolean> {
  const exists = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('CompetitionBonusCriterion','CompetitionBonusEntry')`
  );
  if (exists[0]?.n === 2) return true;
  await prisma.$transaction(STATEMENTS.map(sql => prisma.$executeRawUnsafe(sql)));
  console.info('Tabelas de pontos extras da competição criadas automaticamente.');
  return true;
}

/** Cria as tabelas de pontos extras se ainda não existirem. Nunca lança erro. */
export function ensureCompetitionBonusTables(): Promise<boolean> {
  if (!ready) {
    ready = apply().catch(error => {
      console.error('Não foi possível criar as tabelas de pontos extras automaticamente:', error);
      ready = null; // tenta de novo na próxima requisição
      return false;
    });
  }
  return ready;
}
