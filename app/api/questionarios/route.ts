import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { QuizQuestion } from '@/lib/quizGrading';

export const dynamic = 'force-dynamic';
const json = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

async function checkMeetingAccess(user: any, meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, organizerId: true, companyId: true }
  });
  if (!meeting) return { error: json('DDS não encontrado.', 404) };
  const permitted = user.role === 'SUPER_ADMIN' || meeting.organizerId === user.id ||
    (user.role === 'COMPANY_ADMIN' && Boolean(user.companyId && meeting.companyId === user.companyId));
  return permitted ? { meeting } : { error: json('Acesso negado a este DDS.', 403) };
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
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);

  const url = new URL(req.url);
  const meetingId = url.searchParams.get('meetingId');
  const templatesOnly = url.searchParams.get('templates') === 'true';

  try {
    const whereClause: any = {};

    if (templatesOnly) {
      whereClause.isTemplate = true;
      if (user.role !== 'SUPER_ADMIN') {
        whereClause.creatorId = user.id;
      }
    } else if (meetingId && meetingId !== 'ALL' && meetingId !== 'NONE') {
      const access = await checkMeetingAccess(user, meetingId);
      if (access.error) return access.error;
      whereClause.meetingId = meetingId;
    } else if (meetingId === 'NONE') {
      // Apenas questionários autônomos
      whereClause.meetingId = null;
      if (user.role !== 'SUPER_ADMIN') {
        whereClause.creatorId = user.id;
      }
    } else {
      // Todos os questionários do usuário
      if (user.role !== 'SUPER_ADMIN') {
        whereClause.OR = [
          { creatorId: user.id },
          { meeting: { organizerId: user.id } }
        ];
      }
    }

    const quizzes = await prisma.quiz.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        meeting: { select: { id: true, topic: true, farm: true, status: true } },
        questions: {
          orderBy: { position: 'asc' },
          include: { options: { orderBy: { position: 'asc' } } }
        },
        attempts: {
          select: {
            id: true,
            score: true,
            passed: true,
            level: true,
            submittedAt: true,
            participantName: true,
            attendance: { select: { id: true, name: true } }
          }
        }
      }
    });

    return NextResponse.json({ success: true, quizzes }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Erro ao consultar questionários:', err);
    return json('Falha ao consultar questionários.', 500);
  }
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);

  let body: any;
  try { body = await req.json(); } catch { return json('JSON inválido.', 400); }

  const action = body.action;

  // AÇÃO 1: CLONAR QUESTIONÁRIO / REAVALIAÇÃO
  if (action === 'clone' || action === 'reopen') {
    const sourceQuizId = body.sourceQuizId;
    if (typeof sourceQuizId !== 'string') return json('ID do questionário de origem obrigatório.', 400);

    const source = await prisma.quiz.findUnique({
      where: { id: sourceQuizId },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: { options: { orderBy: { position: 'asc' } } }
        }
      }
    });
    if (!source) return json('Questionário de origem não encontrado.', 404);

    const newMeetingId = body.meetingId || null;
    if (newMeetingId) {
      const access = await checkMeetingAccess(user, newMeetingId);
      if (access.error) return access.error;
    }

    const isReevaluation = action === 'reopen';
    const newTitle = body.title?.trim() || (isReevaluation ? `${source.title} (Reavaliação)` : `${source.title} (Cópia)`);

    const cloned = await prisma.quiz.create({
      data: {
        meetingId: newMeetingId,
        creatorId: user.id,
        title: newTitle,
        passingScore: source.passingScore,
        criticalBelow: source.criticalBelow,
        excellentFrom: source.excellentFrom,
        status: isReevaluation ? 'PUBLISHED' : 'DRAFT',
        publishedAt: isReevaluation ? new Date() : null,
        templateId: source.templateId || source.id,
        isTemplate: Boolean(body.isTemplate),
        questions: {
          create: source.questions.map((q, qPos) => ({
            text: q.text,
            type: q.type,
            weight: q.weight,
            position: qPos,
            explanation: q.explanation,
            options: {
              create: q.options.map((o, oPos) => ({
                text: o.text,
                isCorrect: o.isCorrect,
                position: oPos
              }))
            }
          }))
        }
      },
      select: { id: true, title: true, status: true, shareToken: true }
    });

    return NextResponse.json({ success: true, quiz: cloned }, { status: 201 });
  }

  // AÇÃO 2: SALVAR COMO FORMULÁRIO BASE (TEMPLATE REUTILIZÁVEL)
  const isTemplate = Boolean(body.isTemplate);
  const meetingId = (typeof body.meetingId === 'string' && body.meetingId.trim()) ? body.meetingId.trim() : null;

  if (meetingId) {
    const access = await checkMeetingAccess(user, meetingId);
    if (access.error) return access.error;
  }

  const data = validate(body);
  if (!data) return json('Revise título, questões, gabarito e limites de desempenho.', 400);

  try {
    const quiz = await prisma.quiz.create({
      data: {
        meetingId: meetingId || null,
        creatorId: user.id,
        title: data.title,
        passingScore: data.passingScore,
        criticalBelow: data.criticalBelow,
        excellentFrom: data.excellentFrom,
        isTemplate,
        questions: {
          create: data.questions.map((q, position) => ({
            text: q.text.trim(),
            type: q.type,
            weight: q.weight,
            position,
            explanation: typeof q.explanation === 'string' ? q.explanation.slice(0, 1000) : null,
            options: {
              create: q.options.map((o, index) => ({
                text: o.text.trim(),
                isCorrect: o.correct,
                position: index
              }))
            }
          }))
        }
      },
      select: { id: true, status: true, shareToken: true, meetingId: true, isTemplate: true }
    });

    return NextResponse.json({ success: true, quiz }, { status: 201 });
  } catch (err) {
    console.error('Erro ao criar questionário:', err);
    return json('Falha ao criar questionário no banco de dados.', 500);
  }
}

export async function PATCH(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);

  let body: any;
  try { body = await req.json(); } catch { return json('JSON inválido.', 400); }

  if (typeof body.id !== 'string') return json('Solicitação inválida.', 400);

  const quiz = await prisma.quiz.findUnique({
    where: { id: body.id },
    select: { id: true, meetingId: true, creatorId: true, status: true, isTemplate: true }
  });
  if (!quiz) return json('Questionário não encontrado.', 404);

  // Autorização
  if (user.role !== 'SUPER_ADMIN' && quiz.creatorId !== user.id) {
    if (quiz.meetingId) {
      const access = await checkMeetingAccess(user, quiz.meetingId);
      if (access.error) return access.error;
    } else {
      return json('Acesso negado.', 403);
    }
  }

  // AÇÃO: Alternar se é Template/Formulário Reutilizável
  if (body.toggleTemplate !== undefined) {
    await prisma.quiz.update({
      where: { id: body.id },
      data: { isTemplate: Boolean(body.toggleTemplate) }
    });
    return NextResponse.json({ success: true, isTemplate: Boolean(body.toggleTemplate) });
  }

  // Transição de Status (DRAFT, PUBLISHED, CLOSED) + Reabertura direta (CLOSED -> PUBLISHED)
  if (body.status) {
    if (!['PUBLISHED', 'CLOSED', 'DRAFT'].includes(body.status)) return json('Status inválido.', 400);

    const updateData: any = { status: body.status };
    if (body.status === 'PUBLISHED') updateData.publishedAt = new Date();
    if (body.status === 'CLOSED') updateData.closedAt = new Date();

    const updated = await prisma.quiz.update({
      where: { id: body.id },
      data: updateData
    });
    return NextResponse.json({ success: true, status: updated.status });
  }

  return json('Nenhuma ação especificada.', 400);
}
