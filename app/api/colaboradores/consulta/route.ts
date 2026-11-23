// app/api/colaboradores/consulta/route.ts
// Consulta pública usada nas telas de assinatura: o colaborador digita a matrícula
// e recebe o nome e a função cadastrados. Só responde dentro de um DDS que está
// aceitando assinaturas (ou de um questionário publicado) e tem limite por aparelho.
//
// GET ?registration=1234&meetingId=<id>   ou   ?registration=1234&quizToken=<token>
// GET ?policy=1&meetingId=<id> (ou quizToken)  → só diz se a empresa aceita não cadastrados/visitantes

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getClientIp } from '@/lib/auth';
import { REGISTRATION_PATTERN } from '@/lib/collaboratorRules';
import { allowLookup, allowsUnregistered, companyIdForMeeting, companyIdForQuiz, lookupCollaborator } from '@/lib/collaborators';

export const dynamic = 'force-dynamic';

const reply = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const registration = (params.get('registration') || '').trim();
  const meetingId = (params.get('meetingId') || '').trim();
  const quizToken = (params.get('quizToken') || '').trim();
  const policyOnly = params.get('policy') === '1';
  if (!policyOnly && !REGISTRATION_PATTERN.test(registration)) return reply({ success: false, error: 'Informe os 4 números da matrícula.' }, 400);
  if (!meetingId && !quizToken) return reply({ success: false, error: 'Consulta inválida.' }, 400);

  if (!policyOnly && !allowLookup(getClientIp(req))) {
    return reply({ success: false, error: 'Muitas consultas seguidas. Aguarde alguns minutos ou preencha seus dados.' }, 429);
  }

  try {
    let companyId: string | null = null;
    if (meetingId) {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { companyId: true, organizerId: true, status: true, attendanceCollectionOpen: true, inviteExpiresAt: true }
      });
      const accepting = meeting && (meeting.status === 'LIVE' || meeting.attendanceCollectionOpen) &&
        (!meeting.inviteExpiresAt || meeting.inviteExpiresAt > new Date());
      if (!accepting) return reply({ success: false, error: 'Este DDS não está aceitando assinaturas.' }, 403);
      companyId = await companyIdForMeeting(meeting!);
    } else {
      if (!/^[0-9a-f-]{36}$/i.test(quizToken)) return reply({ success: false, error: 'Consulta inválida.' }, 400);
      const quiz = await prisma.quiz.findUnique({
        where: { shareToken: quizToken },
        select: { status: true, creatorId: true, meeting: { select: { companyId: true, organizerId: true } } }
      });
      if (!quiz || quiz.status !== 'PUBLISHED') return reply({ success: false, error: 'Questionário indisponível.' }, 403);
      companyId = await companyIdForQuiz(quiz);
    }

    if (policyOnly) return reply({ success: true, allowUnregistered: await allowsUnregistered(companyId) });

    // Empresa sem cadastro configurado: o colaborador preenche normalmente.
    if (!companyId) return reply({ success: true, found: false, allowUnregistered: true });
    const result = await lookupCollaborator(companyId, registration);
    if (!result.available) return reply({ success: true, found: false, allowUnregistered: true });
    if (result.collaborator) return reply({ success: true, found: true, name: result.collaborator.name, role: result.collaborator.role });
    return reply({ success: true, found: false, allowUnregistered: result.allowUnregistered });
  } catch (error) {
    console.error('Erro na consulta de matrícula:', error);
    return reply({ success: false, error: 'Não foi possível consultar a matrícula agora.' }, 500);
  }
}
