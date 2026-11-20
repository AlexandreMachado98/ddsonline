// lib/selfiePolicy.ts
// Selfie de presença opcional por empresa (configurada no DDS Master).
//
// A coluna "Company"."requireSelfie" é criada aqui com SQL idempotente, sem passar pelo
// schema do Prisma, porque o banco é compartilhado com o DDS Master:
//   - empresas que já existiam ficam com a selfie LIGADA (comportamento de antes);
//   - empresas criadas depois disso começam com a selfie DESLIGADA.
// O DDS Master executa as mesmas duas instruções antes de ler ou gravar a opção.

import prisma from '@/lib/prisma';

export const SELFIE_COLUMN_STATEMENTS = [
  'ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "requireSelfie" BOOLEAN NOT NULL DEFAULT true',
  'ALTER TABLE "Company" ALTER COLUMN "requireSelfie" SET DEFAULT false'
];

let ready: Promise<boolean> | null = null;

async function apply(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ d: string | null }[]>(
    `SELECT column_default AS d FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'Company' AND column_name = 'requireSelfie'`
  );
  // Coluna já criada e com o padrão final: nada a fazer (evita travar a tabela à toa).
  if (rows[0] && String(rows[0].d) === 'false') return true;
  for (const sql of SELFIE_COLUMN_STATEMENTS) await prisma.$executeRawUnsafe(sql);
  return true;
}

/** Garante a coluna. Nunca lança erro; em falha, tenta de novo na próxima chamada. */
export function ensureSelfieColumn(): Promise<boolean> {
  if (!ready) {
    ready = apply().catch(error => {
      console.error('Não foi possível preparar a opção de selfie por empresa:', error);
      ready = null;
      return false;
    });
  }
  return ready;
}

/**
 * A empresa exige selfie na presença? Sem empresa identificada, ou se o banco não
 * responder, mantém o comportamento antigo (selfie exigida).
 */
export async function companyRequiresSelfie(companyId: string | null | undefined): Promise<boolean> {
  if (!companyId) return true;
  if (!(await ensureSelfieColumn())) return true;
  try {
    const rows = await prisma.$queryRawUnsafe<{ requireSelfie: boolean }[]>(
      'SELECT "requireSelfie" FROM "Company" WHERE "id" = $1', companyId
    );
    return rows[0]?.requireSelfie ?? true;
  } catch (error) {
    console.error('Falha ao ler a opção de selfie da empresa:', error);
    return true;
  }
}

/** Mesma consulta para várias empresas de uma vez (painel com vários DDS ao vivo). */
export async function requireSelfieByCompany(companyIds: (string | null | undefined)[]): Promise<Map<string, boolean>> {
  const ids = Array.from(new Set(companyIds.filter((id): id is string => Boolean(id))));
  const result = new Map<string, boolean>();
  if (ids.length === 0 || !(await ensureSelfieColumn())) return result;
  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string; requireSelfie: boolean }[]>(
      'SELECT "id", "requireSelfie" FROM "Company" WHERE "id" = ANY($1::text[])', ids
    );
    for (const row of rows) result.set(row.id, row.requireSelfie);
  } catch (error) {
    console.error('Falha ao ler a opção de selfie das empresas:', error);
  }
  return result;
}
