-- Critérios de pontuação extra (manuais) com peso configurável por competição
CREATE TABLE "CompetitionBonusCriterion" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompetitionBonusCriterion_pkey" PRIMARY KEY ("id")
);

-- Lançamentos manuais de pontos extras por colaborador
CREATE TABLE "CompetitionBonusEntry" (
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
);

CREATE INDEX "CompetitionBonusCriterion_competitionId_createdAt_idx" ON "CompetitionBonusCriterion"("competitionId", "createdAt");
CREATE INDEX "CompetitionBonusEntry_competitionId_participantRegistration_idx" ON "CompetitionBonusEntry"("competitionId", "participantRegistration");
CREATE INDEX "CompetitionBonusEntry_criterionId_idx" ON "CompetitionBonusEntry"("criterionId");

ALTER TABLE "CompetitionBonusCriterion" ADD CONSTRAINT "CompetitionBonusCriterion_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionBonusEntry" ADD CONSTRAINT "CompetitionBonusEntry_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionBonusEntry" ADD CONSTRAINT "CompetitionBonusEntry_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "CompetitionBonusCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
