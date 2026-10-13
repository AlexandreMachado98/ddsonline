import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { QuizQuestion } from '@/lib/quizGrading';

export const dynamic = 'force-dynamic';
const json = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

async function allowed(req: Request, meetingId: string) {
  const user = await getAuthenticatedUser(req);
  if (!user) return { error: json('Sessão inválida.', 401) };
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { id: true, organizerId: true, companyId: true } });
  if (!meeting) return { error: json('DDS não encontrado.', 404) };
  const permitted = user.role === 'SUPER_ADMIN' || meeting.organizerId === user.id ||
    (user.role === 'COMPANY_ADMIN' && Boolean(user.companyId && meeting.companyId === user.companyId));
  return permitted ? { meeting } : { error: json('Acesso negado.', 403) };
}

function validate(body: any): { title: string; passingScore: number; criticalBelow: number; excellentFrom: number; questions: QuizQuestion[] } | null {
  if (!body || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 150 ||
      !Array.isArray(body.questions) || body.questions.length < 1 || body.questions.length > 100) return null;
  const passingScore = body.passingScore ?? 70, criticalBelow = body.criticalBelow ?? 40, excellentFrom = body.excellentFrom ?? 90;
  if (![passingScore, criticalBelow, excellentFrom].every(x => Number.isInteger(x) && x >= 0 && x <= 100) ||
      criticalBelow > passingScore || excellentFrom < passingScore) return null;
  const questions: QuizQuestion[] = body.questions;
  if (new Set(questions.map(q => q.id)).size !== questions.length ||
      questions.some(q => typeof q.id !== 'string' || !q.id || typeof q.text !== 'string' || !q.text.trim() || q.text.length > 1000 ||
        !['SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE'].includes(q.type) ||
        !Number.isInteger(q.weight) || q.weight < 1 || q.weight > 100 ||
        !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 12 ||
        (q.type === 'TRUE_FALSE' && q.options.length !== 2) ||
        new Set(q.options.map(o => o.id)).size !== q.options.length ||
        q.options.some(o => typeof o.id !== 'string' || !o.id || typeof o.text !== 'string' || !o.text.trim() || o.text.length > 500 || typeof o.correct !== 'boolean') ||
        !q.options.some(o => o.correct) || (q.type !== 'MULTIPLE_CHOICE' && q.options.filter(o => o.correct).length !== 1)
      )) return null;
  return { title: body.title.trim(), passingScore, criticalBelow, excellentFrom, questions };
}

export async function GET(req: Request) {
  const meetingId = new URL(req.url).searchParams.get('meetingId');
  if (!meetingId) return json('Informe meetingId.', 400);
  const access = await allowed(req, meetingId);
  if (access.error) return access.error;
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { meetingId }, orderBy: { createdAt: 'desc' },
      include: { questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
        attempts: { select: { id: true, score: true, passed: true, level: true, submittedAt: true,
          attendance: { select: { id: true, name: true } } } } }
    });
    return NextResponse.json({ success: true, quizzes }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return json('Falha ao consultar questionários. Verifique a migração.', 500); }
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);
  let body: any;
  try { body = await req.json(); } catch { return json('JSON inválido.', 400); }
  if (typeof body.meetingId !== 'string') return json('Informe o DDS.', 400);
  const access = await allowed(req, body.meetingId);
  if (access.error) return access.error;
  const data = validate(body);
  if (!data) return json('Revise título, questões, gabarito e limites de desempenho.', 400);
  try {
    const quiz = await prisma.quiz.create({ data: {
      meetingId: body.meetingId, title: data.title, passingScore: data.passingScore,
      criticalBelow: data.criticalBelow, excellentFrom: data.excellentFrom,
      questions: { create: data.questions.map((q, position) => ({
        text: q.text.trim(), type: q.type, weight: q.weight, position, explanation: typeof q.explanation === 'string' ? q.explanation.slice(0, 1000) : null,
        options: { create: q.options.map((o, index) => ({ text: o.text.trim(), isCorrect: o.correct, position: index })) }
      })) }
    }, select: { id: true, status: true, shareToken: true } });
    return NextResponse.json({ success: true, quiz }, { status: 201 });
  } catch { return json('Falha ao criar questionário. Verifique a migração.', 500); }
}

export async function PATCH(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);
  let body: any;
  try { body = await req.json(); } catch { return json('JSON inválido.', 400); }
  if (typeof body.id !== 'string' || !['PUBLISHED', 'CLOSED'].includes(body.status)) return json('Solicitação inválida.', 400);
  const quiz = await prisma.quiz.findUnique({ where: { id: body.id }, select: { meetingId: true, status: true } });
  if (!quiz) return json('Questionário não encontrado.', 404);
  const access = await allowed(req, quiz.meetingId);
  if (access.error) return access.error;
  if (!((quiz.status === 'DRAFT' && body.status === 'PUBLISHED') || (quiz.status === 'PUBLISHED' && body.status === 'CLOSED'))) return json('Transição de status não permitida.', 409);
  try {
    const updated = await prisma.quiz.updateMany({ where: { id: body.id, status: quiz.status },
      data: body.status === 'PUBLISHED' ? { status: 'PUBLISHED', publishedAt: new Date() } : { status: 'CLOSED', closedAt: new Date() } });
    if (!updated.count) return json('Status alterado por outra operação.', 409);
    return NextResponse.json({ success: true, status: body.status });
  } catch { return json('Falha ao atualizar questionário.', 500); }
}
