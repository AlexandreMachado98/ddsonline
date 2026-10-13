import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { gradeQuiz, type QuizAnswer, type QuizQuestion } from '@/lib/quizGrading';
import { createHash, timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';
const failure = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });
const fingerprint = (v: string) => createHash('sha256').update(v).digest();
function equals(a: string, b: string) { return timingSafeEqual(fingerprint(a), fingerprint(b)); }

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return failure('JSON inválido.', 400); }
  const { token, attendanceId, answers, attendanceProof } = body || {};
  if (typeof token !== 'string' || !/^[a-f0-9-]{36}$/i.test(token) ||
      typeof attendanceId !== 'string' || attendanceId.length > 100 ||
      typeof attendanceProof !== 'string' || attendanceProof.length < 16 || attendanceProof.length > 256 ||
      !Array.isArray(answers) || answers.length > 100 ||
      answers.some((a: any) => !a || typeof a.questionId !== 'string' || !Array.isArray(a.selectedOptionIds) ||
        a.selectedOptionIds.length > 12 || a.selectedOptionIds.some((id: unknown) => typeof id !== 'string'))) {
    return failure('Dados de envio inválidos.', 400);
  }
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { shareToken: token },
      include: { meeting: { select: { id: true, status: true } },
        questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } } }
    });
    if (!quiz || quiz.status !== 'PUBLISHED' || quiz.meeting.status !== 'LIVE') return failure('Questionário indisponível.', 403);
    const attendance = await prisma.attendance.findFirst({
      where: { id: attendanceId, meetingId: quiz.meetingId },
      select: { id: true, signature: true }
    });
    if (!attendance) return failure('Presença não encontrada neste DDS.', 403);
    // A API de presenças atual não emite credencial de posse segura. Até isso ser integrado,
    // NÃO aceitar respostas: attendanceId é público e assinatura não é segredo.
    // attendanceProof deverá ser um token aleatório, com hash persistido por presença.
    return failure('Envio temporariamente indisponível até habilitar credencial individual de presença.', 503);
  } catch { return failure('Não foi possível registrar a avaliação.', 500); }
}
