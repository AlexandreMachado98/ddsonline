// lib/quizAccess.ts
// Isolamento por empresa dos questionários avulsos (sem DDS vinculado).
// Antes, qualquer organizador da plataforma via e podia alterar os questionários
// avulsos de outras empresas, com as respostas (nome, matrícula e função).

import prisma from '@/lib/prisma';

type SessionLike = { id: string; role: string; companyId?: string | null };

/**
 * Condições (para um OR do Prisma) que tornam visível um questionário avulso:
 * criado pelo próprio usuário, criado por alguém da mesma empresa, ou modelo da
 * plataforma (sem criador), que não guarda respostas de ninguém.
 */
export function standaloneQuizVisibility(user: SessionLike) {
  return [
    { meetingId: null, creatorId: user.id },
    ...(user.companyId ? [{ meetingId: null, creator: { companyId: user.companyId } }] : []),
    { meetingId: null, creatorId: null, isTemplate: true }
  ];
}

/** Pode alterar/excluir um questionário avulso: o criador ou alguém da mesma empresa do criador. */
export async function canManageStandaloneQuiz(user: SessionLike, quiz: { creatorId: string | null }) {
  if (user.role === 'SUPER_ADMIN') return true;
  if (!quiz.creatorId) return false; // modelos da plataforma: só leitura
  if (quiz.creatorId === user.id) return true;
  if (!user.companyId) return false;
  const creator = await prisma.user.findUnique({ where: { id: quiz.creatorId }, select: { companyId: true } });
  return creator?.companyId === user.companyId;
}

/** Pode usar como origem (clonar/ver): o que pode alterar ou um modelo da plataforma. */
export async function canReadStandaloneQuiz(user: SessionLike, quiz: { creatorId: string | null; isTemplate: boolean }) {
  if (!quiz.creatorId && quiz.isTemplate) return true;
  return canManageStandaloneQuiz(user, quiz);
}
