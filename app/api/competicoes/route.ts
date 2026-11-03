import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const json = (error: string, status: number) =>
  NextResponse.json({ success: false, error }, { status });

function canManage(user: any, competition: any) {
  return user.role === 'SUPER_ADMIN' ||
    competition.organizerId === user.id ||
    (user.role === 'COMPANY_ADMIN' && user.companyId === competition.companyId);
}

async function refreshCompetitionEvents(competition: any) {
  const start = new Date(competition.startDate);
  const end = new Date(competition.endDate);
  end.setHours(23, 59, 59, 999);

  const attendances = await prisma.attendance.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      registration: { not: null, notIn: [''] },
      meeting: { companyId: competition.companyId, classification: 'DDS' }
    },
    select: { id: true, name: true, registration: true, createdAt: true }
  });

  const attempts = await prisma.quizAttempt.findMany({
    where: {
      submittedAt: { gte: start, lte: end },
      participantRegistration: { not: null, notIn: [''] },
      OR: [
        { quiz: { meeting: { companyId: competition.companyId } } },
        { quiz: { creator: { companyId: competition.companyId } } }
      ]
    },
    select: {
      id: true, quizId: true, participantName: true, participantRegistration: true,
      score: true, earnedPoints: true, possiblePoints: true, submittedAt: true, timeSpentSeconds: true
    }
  });

  const events = [
    ...attendances.map((a: any) => ({
      competitionId: competition.id,
      type: 'DDS_ATTENDANCE' as const,
      sourceId: a.id,
      participantRegistration: a.registration!.trim(),
      participantName: a.name,
      points: competition.ddsAttendancePoints,
      details: { date: a.createdAt.toISOString() }
    })),
    ...(() => {
      // Uma participação por colaborador e questionário: em caso de novas tentativas,
      // considera o melhor desempenho para evitar pontuação artificial por repetição.
      const bestAttempts = new Map<string, any>();
      for (const attempt of attempts as any[]) {
        const registration = attempt.participantRegistration?.trim();
        if (!registration) continue;
        const key = registration + ':' + attempt.quizId;
        const previous = bestAttempts.get(key);
        if (!previous || attempt.score > previous.score || (attempt.score === previous.score && (attempt.timeSpentSeconds ?? Infinity) < (previous.timeSpentSeconds ?? Infinity))) bestAttempts.set(key, attempt);
      }
      return [...bestAttempts.values()].flatMap((a: any) => {
        const registration = a.participantRegistration.trim();
        const name = a.participantName?.trim() || 'Colaborador';
        const sourceId = registration + ':' + a.quizId;
        return [
          {
            competitionId: competition.id,
            type: 'QUIZ_PARTICIPATION' as const,
            sourceId,
            participantRegistration: registration,
            participantName: name,
            points: competition.quizParticipationPoints,
            details: { quizId: a.quizId, date: a.submittedAt.toISOString() }
          },
          {
            competitionId: competition.id,
            type: 'QUIZ_PERFORMANCE' as const,
            sourceId,
            participantRegistration: registration,
            participantName: name,
            points: Math.max(0, Math.round((a.score || 0) * competition.quizPerformancePoints)),
            details: { quizId: a.quizId, score: a.score, earnedPoints: a.earnedPoints, possiblePoints: a.possiblePoints }
          }
          ...(typeof a.timeSpentSeconds === 'number' && a.timeSpentSeconds > 0 && a.timeSpentSeconds <= 90 ? [{
            competitionId: competition.id,
            type: 'QUIZ_SPEED' as const,
            sourceId,
            participantRegistration: registration,
            participantName: name,
            points: competition.quizSpeedPoints,
            details: { quizId: a.quizId, timeSpentSeconds: a.timeSpentSeconds, thresholdSeconds: 90 }
          }] : [])
        ];
      });
    })()
  ];

  await prisma.competitionEvent.deleteMany({ where: { competitionId: competition.id } });
  if (events.length) {
    await prisma.competitionEvent.createMany({ data: events });
  }
}

export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);

  try {
    const competitions = await prisma.competition.findMany({
      where: user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId || '__none__' },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { events: { orderBy: { createdAt: 'asc' } } }
    });

    const now = new Date();
    for (const competition of competitions) {
      if (competition.status === 'CANCELLED' || competition.status === 'FINISHED') continue;
      if (competition.endDate < now) {
        await refreshCompetitionEvents(competition);
        await prisma.competition.update({ where: { id: competition.id }, data: { status: 'FINISHED' } });
        continue;
      }
      if (competition.startDate <= now && competition.status === 'SCHEDULED') {
        await prisma.competition.update({ where: { id: competition.id }, data: { status: 'ACTIVE' } });
      }
      await refreshCompetitionEvents(competition);
    }

    const refreshed = await prisma.competition.findMany({
      where: user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId || '__none__' },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { events: { orderBy: { createdAt: 'asc' } } }
    });

    const result = refreshed.map((competition: any) => {
      const participants = new Map<string, any>();
      for (const event of competition.events) {
        const key = event.participantRegistration;
        const current = participants.get(key) || {
          registration: key, name: event.participantName, totalPoints: 0,
          ddsParticipations: 0, quizParticipations: 0, performancePoints: 0, speedPoints: 0
        };
        current.name = event.participantName || current.name;
        current.totalPoints += event.points;
        if (event.type === 'DDS_ATTENDANCE') current.ddsParticipations += 1;
        if (event.type === 'QUIZ_PARTICIPATION') current.quizParticipations += 1;
        if (event.type === 'QUIZ_PERFORMANCE') current.performancePoints += event.points;
        if (event.type === 'QUIZ_SPEED') current.speedPoints += event.points;
        participants.set(key, current);
      }
      const leaderboard = [...participants.values()].sort((a, b) =>
        b.totalPoints - a.totalPoints || b.performancePoints - a.performancePoints || b.ddsParticipations - a.ddsParticipations || b.quizParticipations - a.quizParticipations || b.speedPoints - a.speedPoints || a.name.localeCompare(b.name, 'pt-BR')
      );
      return { ...competition, events: undefined, leaderboard, eventCount: competition.events.length };
    });

    return NextResponse.json({ success: true, competitions: result });
  } catch (error) {
    console.error('Erro ao consultar competições:', error);
    return json('Não foi possível carregar as competições.', 500);
  }
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);
  if (!['SUPER_ADMIN', 'COMPANY_ADMIN', 'ORGANIZER'].includes(user.role)) return json('Acesso negado.', 403);

  try {
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const companyId = user.role === 'SUPER_ADMIN' ? body.companyId : user.companyId;
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    const ddsAttendancePoints = Number(body.ddsAttendancePoints ?? 10);
    const quizParticipationPoints = Number(body.quizParticipationPoints ?? 5);
    const quizPerformancePoints = Number(body.quizPerformancePoints ?? 1);
    const quizSpeedPoints = Number(body.quizSpeedPoints ?? 5);

    if (!name || name.length > 120) return json('Informe um nome de até 120 caracteres.', 400);
    if (!companyId) return json('A conta não está vinculada a uma empresa.', 400);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
      return json('Informe um período válido para a competição.', 400);
    }
    if (![ddsAttendancePoints, quizParticipationPoints, quizPerformancePoints, quizSpeedPoints].every(v => Number.isInteger(v) && v >= 0 && v <= 1000)) {
      return json('As pontuações devem ser números inteiros entre 0 e 1000.', 400);
    }

    const competition = await prisma.competition.create({
      data: {
        name, description: typeof body.description === 'string' ? body.description.trim().slice(0, 1000) : null,
        startDate, endDate, companyId, organizerId: user.id,
        ddsAttendancePoints, quizParticipationPoints, quizPerformancePoints, quizSpeedPoints,
        status: startDate > new Date() ? 'SCHEDULED' : 'ACTIVE'
      }
    });
    return NextResponse.json({ success: true, competition }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar competição:', error);
    return json('Não foi possível criar a competição.', 500);
  }
}

export async function PATCH(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json('Sessão inválida.', 401);
  try {
    const body = await req.json();
    if (typeof body.id !== 'string' || !['FINISHED', 'CANCELLED', 'ACTIVE'].includes(body.status)) {
      return json('Solicitação inválida.', 400);
    }
    const competition = await prisma.competition.findUnique({ where: { id: body.id } });
    if (!competition) return json('Competição não encontrada.', 404);
    if (!canManage(user, competition)) return json('Acesso negado a esta competição.', 403);
    if (body.status === 'FINISHED') await refreshCompetitionEvents(competition);
    const updated = await prisma.competition.update({ where: { id: competition.id }, data: { status: body.status } });
    return NextResponse.json({ success: true, competition: updated });
  } catch (error) {
    console.error('Erro ao atualizar competição:', error);
    return json('Não foi possível atualizar a competição.', 500);
  }
}
