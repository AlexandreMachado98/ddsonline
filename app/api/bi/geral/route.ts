import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseRange(params: URLSearchParams) {
  const period = params.get('period') || 'all';
  const now = new Date();
  let from: Date | undefined;
  let to: Date | undefined;
  if (period === '7d' || period === '30d' || period === '90d') {
    from = new Date(now.getTime() - Number(period.replace('d', '')) * 86400000);
  } else if (period === 'year') {
    from = new Date(now.getFullYear(), 0, 1);
  } else if (period === 'custom') {
    const start = params.get('startDate');
    const end = params.get('endDate');
    if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) from = new Date(start + 'T00:00:00.000Z');
    if (end && /^\d{4}-\d{2}-\d{2}$/.test(end)) to = new Date(end + 'T23:59:59.999Z');
  }
  if ((from && isNaN(from.getTime())) || (to && isNaN(to.getTime())) || (from && to && from > to)) {
    throw new Error('Intervalo de datas inválido.');
  }
  return from || to ? { gte: from, lte: to } : undefined;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ success: false, error: 'Sessão não autorizada.' }, { status: 401 });

  try {
    const params = new URL(request.url).searchParams;
    const range = parseRange(params);
    const classification = (params.get('classification') || 'ALL').trim();
    const unit = (params.get('unit') || 'ALL').trim();
    const scope = user.role === 'SUPER_ADMIN'
      ? {}
      : user.role === 'COMPANY_ADMIN' && user.companyId
        ? { companyId: user.companyId }
        : { organizerId: user.id };

    const meetingWhere: any = {
      ...scope,
      ...(range ? { createdAt: range } : {}),
      ...(classification !== 'ALL' ? { classification } : {}),
      ...(unit !== 'ALL' ? { farm: unit } : {})
    };
    // Different events must use the same authorization boundary even if they have no linked DDS.
    const quizScope: any = user.role === 'SUPER_ADMIN'
      ? {}
      : user.role === 'COMPANY_ADMIN' && user.companyId
        ? { OR: [{ meeting: { companyId: user.companyId } }, { creator: { companyId: user.companyId } }] }
        : { OR: [{ creatorId: user.id }, { meeting: { organizerId: user.id } }] };
    const quizWhere: any = {
      ...quizScope,
      ...(range ? { createdAt: range } : {}),
      ...(classification !== 'ALL' ? { meeting: { ...scope, classification } } : {}),
      ...(unit !== 'ALL' ? { meeting: { ...scope, ...(classification !== 'ALL' ? { classification } : {}), farm: unit } } : {})
    };

    const [meetings, quizRows] = await Promise.all([
      prisma.meeting.findMany({
        where: meetingWhere,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, topic: true, classification: true, farm: true, type: true,
          status: true, createdAt: true, endedAt: true,
          _count: { select: { attendees: true } }
        }
      }),
      prisma.quiz.findMany({
        where: quizWhere,
        select: {
          id: true, title: true, status: true, meetingId: true, createdAt: true,
          attempts: {
            where: range ? { submittedAt: range } : {},
            select: { score: true, passed: true, participantName: true, participantDoc: true, attendanceId: true }
          }
        }
      })
    ]);

    const countBy = (values: string[]) => Object.entries(values.reduce<Record<string, number>>((acc, key) => {
      acc[key] = (acc[key] || 0) + 1; return acc;
    }, {})).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

    const normalizeKind = (kind: string | null) => (kind || 'DDS').trim().toLocaleUpperCase('pt-BR');
    const byKind = countBy(meetings.map(m => normalizeKind(m.classification)));
    const byUnit = countBy(meetings.map(m => m.farm?.trim() || 'Não informada'));
    const monthlyMap = new Map<string, { label: string; activities: number; presences: number }>();
    for (const meeting of meetings) {
      const key = meeting.createdAt.toISOString().slice(0, 7);
      const item = monthlyMap.get(key) || { label: key, activities: 0, presences: 0 };
      item.activities++;
      item.presences += meeting._count.attendees;
      monthlyMap.set(key, item);
    }
    const attempts = quizRows.flatMap(q => q.attempts);
    const approved = attempts.filter(a => a.passed).length;
    const uniqueQuizPeople = new Set(attempts.map((a, i) => a.participantDoc?.trim() ||
      a.attendanceId || a.participantName?.trim().toLocaleLowerCase('pt-BR') || 'attempt-' + i)).size;
    const totalPresences = meetings.reduce((sum, m) => sum + m._count.attendees, 0);
    const closed = meetings.filter(m => m.status !== 'LIVE' && m.status !== 'ACTIVE').length;
    const unansweredActivities = meetings.filter(m => m._count.attendees === 0).length;

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      filters: { period: params.get('period') || 'all', classification, unit },
      indicators: {
        totalActivities: meetings.length,
        totalDDS: meetings.filter(m => normalizeKind(m.classification) === 'DDS').length,
        totalCampaigns: meetings.filter(m => normalizeKind(m.classification).includes('CAMPANHA')).length,
        totalTrainings: meetings.filter(m => normalizeKind(m.classification).includes('TREINAMENTO')).length,
        completedActivities: closed,
        totalPresences, averagePresences: meetings.length ? totalPresences / meetings.length : 0,
        activitiesWithoutPresences: unansweredActivities,
        totalQuizzes: quizRows.length, totalAttempts: attempts.length,
        uniqueQuizParticipants: uniqueQuizPeople,
        averageQuizScore: attempts.length ? attempts.reduce((s, a) => s + a.score, 0) / attempts.length : 0,
        quizApprovalRate: attempts.length ? approved / attempts.length * 100 : 0
      },
      charts: { byKind, byUnit, monthly: Array.from(monthlyMap.values()).sort((a, b) => a.label.localeCompare(b.label)) },
      classifications: [...new Set(meetings.map(m => m.classification || 'DDS'))].sort(),
      units: [...new Set(meetings.map(m => m.farm?.trim() || 'Não informada'))].sort(),
      recentActivities: meetings.slice(0, 12).map(m => ({
        id: m.id, topic: m.topic, classification: m.classification || 'DDS',
        unit: m.farm, date: m.createdAt, status: m.status, presences: m._count.attendees
      })),
      note: 'Presenças são registros em DDS, não pessoas únicas. Questionários são agregados pelo período de criação; tentativas, pelo período de resposta.'
    });
  } catch (error) {
    console.error('Erro no BI geral:', error);
    return NextResponse.json({ success: false, error: error instanceof Error && error.message === 'Intervalo de datas inválido.' ? error.message : 'Falha ao consultar indicadores.' }, { status: 500 });
  }
}
