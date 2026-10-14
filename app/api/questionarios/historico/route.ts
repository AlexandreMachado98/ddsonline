import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const jsonError = (error: string, status: number) =>
  NextResponse.json({ success: false, error }, { status });

export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return jsonError('Sessão expirada. Faça login.', 401);

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(5, parseInt(url.searchParams.get('pageSize') || '10', 10)));
  const search = (url.searchParams.get('search') || '').trim();
  const status = url.searchParams.get('status') || 'ALL';
  const meetingId = url.searchParams.get('meetingId') || 'ALL';
  const sortBy = url.searchParams.get('sortBy') || 'createdAt';
  const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const companyId = url.searchParams.get('companyId');

  try {
    // 1. FILTRO DE SEGURANÇA E MULTI-TENANT
    const where: any = {};

    if (user.role === 'SUPER_ADMIN') {
      if (companyId && companyId !== 'ALL') {
        where.OR = [
          { meeting: { companyId } },
          { creator: { companyId } }
        ];
      }
    } else if (user.role === 'COMPANY_ADMIN') {
      if (user.companyId) {
        where.OR = [
          { meeting: { companyId: user.companyId } },
          { creator: { companyId: user.companyId } },
          { meetingId: null, creatorId: user.id }
        ];
      } else {
        where.creatorId = user.id;
      }
    } else {
      where.OR = [
        { meetingId: null },
        { creatorId: user.id },
        { meeting: { organizerId: user.id } },
        ...(user.companyId ? [{ meeting: { companyId: user.companyId } }] : [])
      ];
    }

    // Filtro de Status
    if (status !== 'ALL' && ['PUBLISHED', 'CLOSED', 'DRAFT'].includes(status)) {
      where.status = status;
    }

    // Filtro de DDS
    if (meetingId === 'NONE') {
      where.meetingId = null;
    } else if (meetingId !== 'ALL' && /^[0-9a-f-]{36}$/i.test(meetingId)) {
      where.meetingId = meetingId;
    }

    // Busca textual
    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { meeting: { topic: { contains: search, mode: 'insensitive' } } },
            { meeting: { farm: { contains: search, mode: 'insensitive' } } }
          ]
        }
      ];
    }

    // Filtro por Data
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // 2. CONTAGEM TOTAL PARA PAGINAÇÃO
    const totalCount = await prisma.quiz.count({ where });

    // 3. CONSULTA PAGINADA
    const orderByClause: any = {};
    if (['createdAt', 'title', 'status'].includes(sortBy)) {
      orderByClause[sortBy] = sortOrder;
    } else {
      orderByClause.createdAt = 'desc';
    }

    const quizzes = await prisma.quiz.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: orderByClause,
      select: {
        id: true,
        title: true,
        status: true,
        passingScore: true,
        criticalBelow: true,
        excellentFrom: true,
        shareToken: true,
        showRanking: true,
        isTemplate: true,
        createdAt: true,
        publishedAt: true,
        closedAt: true,
        meetingId: true,
        meeting: {
          select: {
            id: true,
            topic: true,
            farm: true,
            status: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            questions: true,
            attempts: true
          }
        },
        attempts: {
          select: {
            id: true,
            score: true,
            passed: true,
            participantName: true,
            attendance: { select: { name: true } }
          }
        }
      }
    });

    // 4. AGREGAÇÃO DOS DADOS HISTÓRICOS
    const items = quizzes.map(q => {
      const attemptsCount = q.attempts.length;
      let scoreSum = 0;
      let passedCount = 0;
      const participantsSet = new Set<string>();

      q.attempts.forEach(a => {
        scoreSum += a.score;
        if (a.passed) passedCount++;
        const name = (a.participantName || a.attendance?.name || '').trim().toLowerCase();
        if (name) participantsSet.add(name);
      });

      const avgScore = attemptsCount > 0 ? Math.round((scoreSum / attemptsCount) * 10) / 10 : 0;
      const approvalRate = attemptsCount > 0 ? Math.round((passedCount / attemptsCount) * 100) : 0;

      return {
        id: q.id,
        title: q.title,
        status: q.status,
        shareToken: q.shareToken,
        passingScore: q.passingScore,
        criticalBelow: q.criticalBelow,
        excellentFrom: q.excellentFrom,
        showRanking: q.showRanking,
        createdAt: q.createdAt.toISOString(),
        publishedAt: q.publishedAt?.toISOString() || null,
        closedAt: q.closedAt?.toISOString() || null,
        meetingId: q.meetingId,
        meetingTopic: q.meeting?.topic || null,
        meetingFarm: q.meeting?.farm || null,
        meetingStatus: q.meeting?.status || null,
        questionsCount: q._count.questions,
        totalAttempts: attemptsCount,
        uniqueParticipants: participantsSet.size,
        averageScore: avgScore,
        approvalRate,
        isClosed: q.status === 'CLOSED',
        isPartial: q.status === 'PUBLISHED'
      };
    });

    const totalPages = Math.ceil(totalCount / pageSize);

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    });

  } catch (err) {
    console.error('Erro na API de Histórico de Questionários:', err);
    return jsonError('Falha ao consultar histórico de questionários.', 500);
  }
}
