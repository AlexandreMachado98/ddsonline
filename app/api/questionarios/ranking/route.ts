// app/api/questionarios/ranking/route.ts
// Endpoint Seguro para Consulta e Atualização em Tempo Real do Ranking de Desempenho

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { computeQuizRanking } from '@/lib/quizRanking';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const quizId = url.searchParams.get('quizId');

  try {
    // =========================================================================
    // CENÁRIO 1: ACESSO DO COLABORADOR VIA TOKEN PÚBLICO
    // =========================================================================
    if (token) {
      if (!/^[0-9a-f-]{36}$/i.test(token)) {
        return NextResponse.json({ success: false, error: 'Token de avaliação inválido.' }, { status: 400 });
      }

      const quiz = await prisma.quiz.findUnique({
        where: { shareToken: token },
        select: {
          id: true,
          title: true,
          status: true,
          passingScore: true,
          showRanking: true,
          meeting: { select: { topic: true, farm: true, status: true } },
          questions: { select: { id: true, weight: true } },
          attempts: {
            select: {
              id: true,
              score: true,
              earnedPoints: true,
              possiblePoints: true,
              passed: true,
              level: true,
              submittedAt: true,
              timeSpentSeconds: true,
              participantName: true,
              participantDoc: true,
              attendance: { select: { id: true, name: true } },
              answers: {
                select: {
                  id: true,
                  correct: true,
                  earnedPoints: true
                }
              }
            }
          }
        }
      });

      if (!quiz) {
        return NextResponse.json({ success: false, error: 'Questionário não encontrado.' }, { status: 404 });
      }

      // Regra de Privacidade e LGPD: Somente exibe aos participantes se o gestor habilitar explicitamente
      if (!quiz.showRanking) {
        return NextResponse.json({
          success: false,
          error: 'O ranking deste questionário está configurado como privado pelo gestor de segurança.'
        }, { status: 403 });
      }

      // Calcula ranking com sanitização de nomes (isPublicView = true)
      const rankingSummary = computeQuizRanking(
        quiz.attempts,
        quiz.questions.length,
        {
          quizId: quiz.id,
          quizTitle: quiz.title,
          isPublicView: true
        }
      );

      return NextResponse.json({
        success: true,
        isPublic: true,
        showRanking: quiz.showRanking,
        summary: rankingSummary,
        quiz: {
          id: quiz.id,
          title: quiz.title,
          passingScore: quiz.passingScore,
          status: quiz.status,
          topic: quiz.meeting?.topic || null,
          farm: quiz.meeting?.farm || null
        }
      }, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      });
    }

    // =========================================================================
    // CENÁRIO 2: ACESSO ADMINISTRATIVO DO ORGANIZADOR / GESTOR
    // =========================================================================
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Sessão expirada. Faça login.' }, { status: 401 });
    }

    if (!quizId) {
      return NextResponse.json({ success: false, error: 'ID do questionário ou token obrigatório.' }, { status: 400 });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        meeting: { select: { id: true, topic: true, farm: true, organizerId: true, companyId: true, status: true } },
        questions: { select: { id: true, weight: true } },
        attempts: {
          select: {
            id: true,
            score: true,
            earnedPoints: true,
            possiblePoints: true,
            passed: true,
            level: true,
            submittedAt: true,
            timeSpentSeconds: true,
            participantName: true,
            participantDoc: true,
            attendance: { select: { id: true, name: true } },
            answers: {
              select: {
                id: true,
                correct: true,
                earnedPoints: true
              }
            }
          }
        }
      }
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: 'Questionário não encontrado.' }, { status: 404 });
    }

    // Controle de Acesso e Isolamento de Tenant
    if (user.role !== 'SUPER_ADMIN' && quiz.creatorId !== user.id) {
      if (quiz.meetingId && quiz.meeting) {
        const permitted = quiz.meeting.organizerId === user.id ||
          (user.role === 'COMPANY_ADMIN' && Boolean(user.companyId && quiz.meeting.companyId === user.companyId));
        if (!permitted) {
          return NextResponse.json({ success: false, error: 'Acesso negado a este questionário.' }, { status: 403 });
        }
      }
    }

    // Calcula ranking completo para o gestor (sem restrição de nomes)
    const rankingSummary = computeQuizRanking(
      quiz.attempts,
      quiz.questions.length,
      {
        quizId: quiz.id,
        quizTitle: quiz.title,
        isPublicView: false
      }
    );

    return NextResponse.json({
      success: true,
      isPublic: false,
      showRanking: quiz.showRanking,
      summary: rankingSummary,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        passingScore: quiz.passingScore,
        status: quiz.status,
        shareToken: quiz.shareToken,
        showRanking: quiz.showRanking,
        topic: quiz.meeting?.topic || null,
        farm: quiz.meeting?.farm || null
      }
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    });

  } catch (error: any) {
    console.error('Erro na rota /api/questionarios/ranking:', error);
    return NextResponse.json({ success: false, error: 'Falha interna ao carregar o ranking.' }, { status: 500 });
  }
}
