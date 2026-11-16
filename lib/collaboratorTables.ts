// lib/collaboratorTables.ts
// Cria as tabelas do cadastro de colaboradores se ainda não existirem (mesmo SQL da
// migração 20261119000000_collaborators). Roda uma vez por instância do servidor.

import prisma from '@/lib/prisma';

const STATEMENTS: string[] = [
  "CREATE TABLE IF NOT EXISTS \"Collaborator\" (\n    \"id\" TEXT NOT NULL,\n    \"companyId\" TEXT NOT NULL,\n    \"registration\" TEXT NOT NULL,\n    \"name\" TEXT NOT NULL,\n    \"role\" TEXT NOT NULL,\n    \"createdById\" TEXT,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"Collaborator_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"CollaboratorSettings\" (\n    \"companyId\" TEXT NOT NULL,\n    \"allowUnregistered\" BOOLEAN NOT NULL DEFAULT true,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"CollaboratorSettings_pkey\" PRIMARY KEY (\"companyId\")\n)",
  "CREATE INDEX IF NOT EXISTS \"Collaborator_companyId_name_idx\" ON \"Collaborator\"(\"companyId\", \"name\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"Collaborator_companyId_registration_key\" ON \"Collaborator\"(\"companyId\", \"registration\")",
  "DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Collaborator_companyId_fkey') THEN\n    ALTER TABLE \"Collaborator\" ADD CONSTRAINT \"Collaborator_companyId_fkey\" FOREIGN KEY (\"companyId\") REFERENCES \"Company\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;\n  END IF;\nEND $$",
  "DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CollaboratorSettings_companyId_fkey') THEN\n    ALTER TABLE \"CollaboratorSettings\" ADD CONSTRAINT \"CollaboratorSettings_companyId_fkey\" FOREIGN KEY (\"companyId\") REFERENCES \"Company\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;\n  END IF;\nEND $$"
];

let ready: Promise<boolean> | null = null;

async function apply(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('Collaborator','CollaboratorSettings')`
  );
  if (rows[0]?.n === 2) return true;
  await prisma.$transaction(STATEMENTS.map(sql => prisma.$executeRawUnsafe(sql)));
  console.info('Tabelas do cadastro de colaboradores criadas automaticamente.');
  return true;
}

/** Garante as tabelas do cadastro. Nunca lança erro; em falha, tenta de novo na próxima chamada. */
export function ensureCollaboratorTables(): Promise<boolean> {
  if (!ready) {
    ready = apply().catch(error => {
      console.error('Não foi possível criar as tabelas do cadastro de colaboradores:', error);
      ready = null;
      return false;
    });
  }
  return ready;
}
