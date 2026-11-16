-- Cadastro de colaboradores por empresa. Idempotente.

CREATE TABLE IF NOT EXISTS "Collaborator" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collaborator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CollaboratorSettings" (
    "companyId" TEXT NOT NULL,
    "allowUnregistered" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaboratorSettings_pkey" PRIMARY KEY ("companyId")
);

CREATE INDEX IF NOT EXISTS "Collaborator_companyId_name_idx" ON "Collaborator"("companyId", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "Collaborator_companyId_registration_key" ON "Collaborator"("companyId", "registration");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Collaborator_companyId_fkey') THEN
    ALTER TABLE "Collaborator" ADD CONSTRAINT "Collaborator_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CollaboratorSettings_companyId_fkey') THEN
    ALTER TABLE "CollaboratorSettings" ADD CONSTRAINT "CollaboratorSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
