// lib/collaborators.ts
// Consulta ao cadastro de colaboradores na hora da assinatura (servidor).

import prisma from '@/lib/prisma';
import { ensureCollaboratorTables } from '@/lib/collaboratorTables';
import { REGISTRATION_PATTERN, normalizePersonName, normalizeRole } from '@/lib/collaboratorRules';

export const VISITOR_BLOCKED_MESSAGE =
  'Esta empresa aceita assinatura só com matrícula cadastrada. Procure o organizador do DDS.';

export const UNREGISTERED_BLOCKED_MESSAGE =
  'Matrícula não cadastrada. Confira o número. Se estiver certo, procure o organizador do DDS para fazer seu cadastro.';

/** Empresa dona de um DDS: a do próprio DDS ou, se vazia, a do organizador. */
export async function companyIdForMeeting(meeting: { companyId?: string | null; organizerId?: string | null }): Promise<string | null> {
  if (meeting.companyId) return meeting.companyId;
  if (!meeting.organizerId) return null;
  const organizer = await prisma.user.findUnique({ where: { id: meeting.organizerId }, select: { companyId: true } });
  return organizer?.companyId || null;
}

/** Empresa dona de um questionário: a do DDS vinculado ou a do criador. */
export async function companyIdForQuiz(quiz: { meeting?: { companyId?: string | null; organizerId?: string | null } | null; creatorId?: string | null }): Promise<string | null> {
  if (quiz.meeting) {
    const fromMeeting = await companyIdForMeeting(quiz.meeting);
    if (fromMeeting) return fromMeeting;
  }
  if (!quiz.creatorId) return null;
  const creator = await prisma.user.findUnique({ where: { id: quiz.creatorId }, select: { companyId: true } });
  return creator?.companyId || null;
}

export async function lookupCollaborator(companyId: string, registration: string) {
  if (!(await ensureCollaboratorTables())) return { available: false as const };
  const [collaborator, settings] = await Promise.all([
    prisma.collaborator.findUnique({ where: { companyId_registration: { companyId, registration } }, select: { name: true, role: true } }),
    prisma.collaboratorSettings.findUnique({ where: { companyId }, select: { allowUnregistered: true } })
  ]);
  return { available: true as const, collaborator, allowUnregistered: settings?.allowUnregistered ?? true };
}

/** A empresa aceita quem não está no cadastro (matrícula não cadastrada ou visitante sem matrícula)? */
export async function allowsUnregistered(companyId: string | null): Promise<boolean> {
  if (!companyId) return true;
  try {
    if (!(await ensureCollaboratorTables())) return true;
    const settings = await prisma.collaboratorSettings.findUnique({ where: { companyId }, select: { allowUnregistered: true } });
    return settings?.allowUnregistered ?? true;
  } catch (error) {
    console.error('Falha ao consultar a configuração do cadastro de colaboradores:', error);
    return true;
  }
}

export type ResolvedIdentity =
  | { ok: true; name: string; role: string; registered: boolean }
  | { ok: false; error: string };

/**
 * Decide o nome e a função gravados na assinatura:
 * - matrícula cadastrada → sempre os dados do cadastro (ignora o que foi digitado);
 * - não cadastrada → os dados digitados, se a empresa aceitar; senão, recusa.
 * Em qualquer falha de consulta, segue com os dados digitados para não travar o DDS.
 */
export async function resolveIdentity(companyId: string | null, registration: string, typed: { name: string; role: string }): Promise<ResolvedIdentity> {
  // Fora do cadastro, padroniza o que foi digitado (espaços e maiúsculas) para evitar nomes divergentes.
  const fallback: ResolvedIdentity = { ok: true, name: normalizePersonName(typed.name) || typed.name, role: normalizeRole(typed.role) || typed.role, registered: false };
  // Visitante / terceiro sem matrícula: vale a mesma chave "aceitar não cadastrada".
  if (!registration) {
    return (await allowsUnregistered(companyId)) ? fallback : { ok: false, error: VISITOR_BLOCKED_MESSAGE };
  }
  if (!companyId || !REGISTRATION_PATTERN.test(registration)) return fallback;
  try {
    const result = await lookupCollaborator(companyId, registration);
    if (!result.available) return fallback;
    if (result.collaborator) return { ok: true, name: result.collaborator.name, role: result.collaborator.role, registered: true };
    if (!result.allowUnregistered) return { ok: false, error: UNREGISTERED_BLOCKED_MESSAGE };
    return fallback;
  } catch (error) {
    console.error('Falha ao consultar o cadastro de colaboradores:', error);
    return fallback;
  }
}

// Limite simples de consultas públicas por aparelho/IP, para ninguém listar o
// cadastro testando matrículas em sequência. Memória por instância do servidor.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_LOOKUPS = 40;
const hits = new Map<string, number[]>();

export function allowLookup(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= MAX_LOOKUPS) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) { // evita crescer sem limite
    for (const [k, list] of hits) if (!list.some(t => now - t < WINDOW_MS)) hits.delete(k);
  }
  return true;
}
