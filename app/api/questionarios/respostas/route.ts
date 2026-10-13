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
      select: { id: true, quizProofHash: true }
    });
    if (!attendance) return failure('Presença não encontrada neste DDS.', 403);
    if (!attendance.quizProofHash || !equals(attendance.quizProofHash, createHash('sha256').update(attendanceProof).digest('hex'))) return failure('Credencial individual inválida.', 403);
    if (answers.length !== quiz.questions.length) return failure('Responda todas as perguntas.', 400);
    const questions: QuizQuestion[] = quiz.questions.map(q => ({
      id: q.id, text: q.text, type: q.type as QuizQuestion['type'], weight: q.weight,
      options: q.options.map(o => ({ id: o.id, text: o.text, correct: o.isCorrect })),
      explanation: q.explanation || undefined
    }));
    let result: ReturnType<typeof gradeQuiz>;
    try {
      result = gradeQuiz(questions, answers as QuizAnswer[], {
        passingScore: quiz.passingScore, criticalBelow: quiz.criticalBelow, excellentFrom: quiz.excellentFrom
      });
    } catch { return failure('Respostas ou gabarito inválidos.', 400); }
    try {
      const attempt = await prisma.quizAttempt.create({ data: {
        quizId: quiz.id, attendanceId: attendance.id, score: result.score,
        earnedPoints: result.earnedPoints, possiblePoints: result.possiblePoints,
        passed: result.passed, level: result.level,
        answers: { create: result.questions.map(q => ({
          questionId: q.questionId, selectedOptionIds: q.selectedOptionIds,
          correct: q.correct, earnedPoints: q.earnedPoints
        })) }
      }, select: { id: true } });
      return NextResponse.json({ success: true, attemptId: attempt.id,
        result: { score: result.score, correctCount: result.correctCount,
          totalQuestions: result.totalQuestions, passed: result.passed, level: result.level }
      }, { status: 201 });
    } catch (e: any) {
      if (e?.code === 'P2002') return failure('Este colaborador já respondeu ao questionário.', 409);
      throw e;
    }
  } catch { return failure('Não foi possível registrar a avaliação.', 500); }
}
