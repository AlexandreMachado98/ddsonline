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
  const period = url.searchParams.get('period') || 'all';
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const meetingId = url.searchParams.get('meetingId') || 'ALL';
  const quizId = url.searchParams.get('quizId') || 'ALL';
  const status = url.searchParams.get('status') || 'ALL';
  const theme = (url.searchParams.get('theme') || '').trim();
  const collaborator = (url.searchParams.get('collaborator') || '').trim();
  const scoreRange = url.searchParams.get('scoreRange') || 'ALL';
  const companyId = url.searchParams.get('companyId');

  try {
    // =========================================================================
    // 1. FILTRO DE SEGURANÇA E MULTI-TENANT (RBAC)
    // =========================================================================
    const quizWhere: any = {};

    if (user.role === 'SUPER_ADMIN') {
      if (companyId && companyId !== 'ALL') {
        quizWhere.OR = [
          { meeting: { companyId } },
          { creator: { companyId } }
        ];
      }
    } else if (user.role === 'COMPANY_ADMIN') {
      if (user.companyId) {
        quizWhere.OR = [
          { meeting: { companyId: user.companyId } },
          { creator: { companyId: user.companyId } },
          { meetingId: null, creatorId: user.id }
        ];
      } else {
        quizWhere.creatorId = user.id;
      }
    } else {
      // ORGANIZER
      quizWhere.OR = [
        { meetingId: null },
        { creatorId: user.id },
        { meeting: { organizerId: user.id } },
        ...(user.companyId ? [{ meeting: { companyId: user.companyId } }] : [])
      ];
    }

    // Filtro por Questionário Específico
    if (quizId !== 'ALL' && /^[0-9a-f-]{36}$/i.test(quizId)) {
      quizWhere.id = quizId;
    }

    // Filtro por Status
    if (status !== 'ALL' && ['PUBLISHED', 'CLOSED', 'DRAFT'].includes(status)) {
      quizWhere.status = status;
    }

    // Filtro por DDS
    if (meetingId === 'NONE') {
      quizWhere.meetingId = null;
    } else if (meetingId !== 'ALL' && /^[0-9a-f-]{36}$/i.test(meetingId)) {
      quizWhere.meetingId = meetingId;
    }

    // Filtro por Tema / Busca de Título
    if (theme) {
      quizWhere.AND = [
        ...(quizWhere.AND || []),
        {
          OR: [
            { title: { contains: theme, mode: 'insensitive' } },
            { meeting: { topic: { contains: theme, mode: 'insensitive' } } }
          ]
        }
      ];
    }

    // =========================================================================
    // 2. FILTRO TEMPORAL PARA TENTATIVAS (QuizAttempt)
    // =========================================================================
    const attemptDateWhere: any = {};
    const now = new Date();

    if (period === '7d') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      attemptDateWhere.gte = past;
    } else if (period === '30d') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      attemptDateWhere.gte = past;
    } else if (period === '90d') {
      const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      attemptDateWhere.gte = past;
    } else if (period === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      attemptDateWhere.gte = startOfYear;
    } else if (period === 'custom' && (startDate || endDate)) {
      if (startDate) attemptDateWhere.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        attemptDateWhere.lte = end;
      }
    }

    // =========================================================================
    // 3. CONSULTA OTIMIZADA DOS QUESTIONÁRIOS NO ESCOPO
    // =========================================================================
    const quizzes = await prisma.quiz.findMany({
      where: quizWhere,
      orderBy: { createdAt: 'desc' },
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
            createdAt: true,
            _count: { select: { attendees: true } }
          }
        },
        questions: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            text: true,
            type: true,
            weight: true,
            position: true,
            explanation: true,
            options: {
              orderBy: { position: 'asc' },
              select: { id: true, text: true, isCorrect: true, position: true }
            }
          }
        },
        attempts: {
          where: {
            ...(Object.keys(attemptDateWhere).length > 0 ? { submittedAt: attemptDateWhere } : {}),
            ...(collaborator ? { participantName: { contains: collaborator, mode: 'insensitive' } } : {})
          },
          orderBy: { submittedAt: 'desc' },
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
            participantRegistration: true,
            attendanceId: true,
            attendance: { select: { id: true, name: true } },
            answers: {
              select: {
                id: true,
                questionId: true,
                selectedOptionIds: true,
                correct: true,
                earnedPoints: true
              }
            }
          }
        }
      }
    });

    // =========================================================================
    // 4. PROCESSAMENTO ANALÍTICO DE BI E AGREGAÇÕES
    // =========================================================================
    let totalAttemptsCount = 0;
    let totalScoreSum = 0;
    let totalPassedCount = 0;
    let totalCriticalCount = 0;
    const uniqueParticipantsSet = new Set<string>();
    let totalAttendeesInLinkedMeetings = 0;
    const meetingAttendeesCounted = new Set<string>();

    // Contadores de status de questionários
    let totalQuizzesCreated = quizzes.length;
    let totalQuizzesPublished = 0;
    let totalQuizzesClosed = 0;
    let totalQuizzesInProgress = 0;

    // Histograma de notas (Distribuição)
    const scoreDistribution = {
      critical: 0,   // 0 - 39%
      regular: 0,    // 40 - 69%
      approved: 0,   // 70 - 89%
      excellent: 0   // 90 - 100%
    };

    // Linha do tempo mensal (Evolução)
    const monthlyMap = new Map<string, { label: string; attempts: number; scoreSum: number; participants: Set<string> }>();

    // Tabela analítica de cada questionário
    const analyzedQuizzes = [];

    // Fragilidades por questão
    const questionFragilityMap = new Map<string, {
      questionId: string;
      quizId: string;
      meetingId: string | null;
      quizTitle: string;
      questionText: string;
      totalAnswered: number;
      correctCount: number;
      errorCount: number;
      correctOptionText: string;
      wrongOptionsPicked: Record<string, number>;
    }>();

    // Desempenho consolidado por participante
    const participantAggregates = new Map<string, {
      name: string;
      role: string;
      totalAttempts: number;
      totalScore: number;
      avgScore: number;
      passedCount: number;
      lastSubmission: string;
      attempts: any[];
    }>();

    // Desempenho por DDS
    const ddsPerformanceMap = new Map<string, {
      meetingId: string;
      topic: string;
      farm: string;
      attendeesCount: number;
      quizCount: number;
      attemptsCount: number;
      totalScore: number;
      avgScore: number;
    }>();

    for (const quiz of quizzes) {
      if (quiz.status === 'PUBLISHED') {
        totalQuizzesPublished++;
        totalQuizzesInProgress++;
      } else if (quiz.status === 'CLOSED') {
        totalQuizzesClosed++;
      }

      // Contagem de presentes para taxa de participação dos DDS vinculados
      if (quiz.meetingId && quiz.meeting) {
        if (!meetingAttendeesCounted.has(quiz.meetingId)) {
          meetingAttendeesCounted.add(quiz.meetingId);
          totalAttendeesInLinkedMeetings += quiz.meeting._count?.attendees || 0;
        }

        const dKey = quiz.meetingId;
        if (!ddsPerformanceMap.has(dKey)) {
          ddsPerformanceMap.set(dKey, {
            meetingId: quiz.meetingId,
            topic: quiz.meeting.topic,
            farm: quiz.meeting.farm,
            attendeesCount: quiz.meeting._count?.attendees || 0,
            quizCount: 0,
            attemptsCount: 0,
            totalScore: 0,
            avgScore: 0
          });
        }
        const ddsEntry = ddsPerformanceMap.get(dKey)!;
        ddsEntry.quizCount++;
      }

      let quizAttemptsCount = 0;
      let quizScoreSum = 0;
      let quizPassedCount = 0;
      let highestScore = 0;
      let lowestScore = 100;
      const quizParticipantsSet = new Set<string>();

      // Filtra tentativas por scoreRange se solicitado
      const filteredAttempts = quiz.attempts.filter(att => {
        if (scoreRange === 'CRITICAL') return att.score < 40;
        if (scoreRange === 'REGULAR') return att.score >= 40 && att.score < 70;
        if (scoreRange === 'APPROVED') return att.score >= 70 && att.score < 90;
        if (scoreRange === 'EXCELLENT') return att.score >= 90;
        return true;
      });

      for (const att of filteredAttempts) {
        quizAttemptsCount++;
        totalAttemptsCount++;
        quizScoreSum += att.score;
        totalScoreSum += att.score;

        if (att.passed) {
          quizPassedCount++;
          totalPassedCount++;
        }

        if (att.score < (quiz.criticalBelow || 40)) {
          totalCriticalCount++;
        }

        if (att.score > highestScore) highestScore = att.score;
        if (att.score < lowestScore) lowestScore = att.score;

        // Histograma
        if (att.score < 40) scoreDistribution.critical++;
        else if (att.score < 70) scoreDistribution.regular++;
        else if (att.score < 90) scoreDistribution.approved++;
        else scoreDistribution.excellent++;

        // Nome e Colaborador Único
        const pName = (att.participantName || att.attendance?.name || 'Colaborador Anônimo').trim();
        const pRole = (att.participantDoc || 'Função não informada').trim();
        const normKey = att.participantRegistration && /^\d{4}$/.test(att.participantRegistration)
          ? `matricula:${att.participantRegistration}` : `legado:${pName.toLocaleLowerCase('pt-BR')}`;
        uniqueParticipantsSet.add(normKey);
        quizParticipantsSet.add(normKey);

        // Agregação de Colaboradores
        if (!participantAggregates.has(normKey)) {
          participantAggregates.set(normKey, {
            name: pName,
            role: pRole,
            totalAttempts: 0,
            totalScore: 0,
            avgScore: 0,
            passedCount: 0,
            lastSubmission: att.submittedAt.toISOString(),
            attempts: []
          });
        }
        const pEntry = participantAggregates.get(normKey)!;
        pEntry.totalAttempts++;
        pEntry.totalScore += att.score;
        if (att.passed) pEntry.passedCount++;
        if (pEntry.role === 'Função não informada' && pRole !== 'Função não informada') {
          pEntry.role = pRole;
        }
        pEntry.attempts.push({
          attemptId: att.id,
          quizId: quiz.id,
          quizTitle: quiz.title,
          score: att.score,
          passed: att.passed,
          submittedAt: att.submittedAt.toISOString(),
          timeSpentSeconds: att.timeSpentSeconds
        });

        // Séries Temporais (Mês/Ano)
        const dateObj = new Date(att.submittedAt);
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, { label: monthLabel, attempts: 0, scoreSum: 0, participants: new Set() });
        }
        const mEntry = monthlyMap.get(monthKey)!;
        mEntry.attempts++;
        mEntry.scoreSum += att.score;
        mEntry.participants.add(normKey);

        // DDS Performance
        if (quiz.meetingId && ddsPerformanceMap.has(quiz.meetingId)) {
          const ddsEntry = ddsPerformanceMap.get(quiz.meetingId)!;
          ddsEntry.attemptsCount++;
          ddsEntry.totalScore += att.score;
        }

        // Fragilidade por Questão
        const answersList = att.answers || [];
        for (const q of quiz.questions) {
          const ans = answersList.find(a => a.questionId === q.id);
          const correctOpt = q.options.find(o => o.isCorrect);
          const correctOptionText = correctOpt ? correctOpt.text : 'Gabarito oficial';

          if (!questionFragilityMap.has(q.id)) {
            questionFragilityMap.set(q.id, {
              questionId: q.id,
              quizId: quiz.id,
              meetingId: quiz.meetingId,
              quizTitle: quiz.title,
              questionText: q.text,
              totalAnswered: 0,
              correctCount: 0,
              errorCount: 0,
              correctOptionText,
              wrongOptionsPicked: {}
            });
          }

          const qFrag = questionFragilityMap.get(q.id)!;
          if (ans) {
            qFrag.totalAnswered++;
            if (ans.correct) {
              qFrag.correctCount++;
            } else {
              qFrag.errorCount++;
              const selIds: string[] = Array.isArray(ans.selectedOptionIds) ? (ans.selectedOptionIds as string[]) : [];
              const selOpts = q.options.filter(o => selIds.includes(o.id));
              const wrongText = selOpts.length > 0 ? selOpts.map(o => o.text).join('; ') : 'Opção incorreta';
              qFrag.wrongOptionsPicked[wrongText] = (qFrag.wrongOptionsPicked[wrongText] || 0) + 1;
            }
          }
        }
      }

      // Indicadores Consolidados do Questionário
      const quizAvgScore = quizAttemptsCount > 0 ? Math.round((quizScoreSum / quizAttemptsCount) * 10) / 10 : 0;
      const quizApprovalRate = quizAttemptsCount > 0 ? Math.round((quizPassedCount / quizAttemptsCount) * 100) : 0;

      analyzedQuizzes.push({
        id: quiz.id,
        title: quiz.title,
        status: quiz.status,
        shareToken: quiz.shareToken,
        passingScore: quiz.passingScore,
        criticalBelow: quiz.criticalBelow,
        showRanking: quiz.showRanking,
        createdAt: quiz.createdAt.toISOString(),
        publishedAt: quiz.publishedAt?.toISOString() || null,
        closedAt: quiz.closedAt?.toISOString() || null,
        meetingId: quiz.meetingId,
        meetingTopic: quiz.meeting?.topic || null,
        meetingFarm: quiz.meeting?.farm || null,
        meetingStatus: quiz.meeting?.status || null,
        questionsCount: quiz.questions.length,
        totalParticipants: quizParticipantsSet.size,
        totalAttempts: quizAttemptsCount,
        averageScore: quizAvgScore,
        approvalRate: quizApprovalRate,
        highestScore: quizAttemptsCount > 0 ? highestScore : 0,
        lowestScore: quizAttemptsCount > 0 ? lowestScore : 0,
        isClosed: quiz.status === 'CLOSED',
        isPartial: quiz.status === 'PUBLISHED'
      });
    }

    // =========================================================================
    // 5. CÁLCULO FINAL DE INDICADORES GERAIS
    // =========================================================================
    const overallAverageScore = totalAttemptsCount > 0
      ? Math.round((totalScoreSum / totalAttemptsCount) * 10) / 10
      : 0;

    const approvalRate = totalAttemptsCount > 0
      ? Math.round((totalPassedCount / totalAttemptsCount) * 100)
      : 0;

    const uniqueParticipantsCount = uniqueParticipantsSet.size;

    // Taxa de participação: se houver participantes nos DDS vinculados, calcula percentual
    const participationRate = totalAttendeesInLinkedMeetings > 0
      ? Math.min(100, Math.round((uniqueParticipantsCount / totalAttendeesInLinkedMeetings) * 100))
      : uniqueParticipantsCount > 0 ? 100 : 0;

    // Organização da Linha do Tempo Mensal Ordenada
    const monthlyTimeline = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, data]) => ({
        monthKey: key,
        label: data.label,
        attempts: data.attempts,
        uniqueParticipants: data.participants.size,
        averageScore: data.attempts > 0 ? Math.round((data.scoreSum / data.attempts) * 10) / 10 : 0
      }));

    // Fragilidades Operacionais ordenadas por taxa de erro
    const fragilityReports = Array.from(questionFragilityMap.values())
      .filter(item => item.totalAnswered > 0)
      .map(item => {
        const errorRate = Math.round((item.errorCount / item.totalAnswered) * 100);
        let mostCommonWrong = '';
        let maxWrongCount = 0;
        for (const [wText, wCount] of Object.entries(item.wrongOptionsPicked)) {
          if (wCount > maxWrongCount) {
            maxWrongCount = wCount;
            mostCommonWrong = wText;
          }
        }

        const fragilityLevel: 'CRITICAL' | 'MODERATE' | 'LOW' =
          errorRate >= 50 ? 'CRITICAL' : errorRate >= 20 ? 'MODERATE' : 'LOW';

        let actionPlan = '';
        if (fragilityLevel === 'CRITICAL') {
          actionPlan = `🚨 PLANO DE AÇÃO IMEDIATO (${errorRate}% DE ERRO NA OPERAÇÃO):\n` +
            `• Pauta de Reforço: ${item.questionText}\n` +
            `• Desvio Frequente Detectado: "${mostCommonWrong || 'Conduta insegura assinalada'}"\n` +
            `• Procedimento Padrão Obrigatório: "${item.correctOptionText}"\n` +
            `• Recomendação para o DDS: Realizar demonstração prática em campo com a equipe antes do início da jornada.`;
        } else if (fragilityLevel === 'MODERATE') {
          actionPlan = `⚠️ PLANO DE ALINHAMENTO PREVENTIVO (${errorRate}% DE ERRO):\n` +
            `• Assunto: ${item.questionText}\n` +
            `• Conduta Correta: "${item.correctOptionText}"\n` +
            `• Recomendação: Esclarecer pontos de dúvida no próximo DDS para evitar formação de vícios comportamentais.`;
        } else {
          actionPlan = `✅ PROCEDIMENTO CONSOLIDADO (${item.correctCount}/${item.totalAnswered} acertos):\n` +
            `• A equipe demonstrou excelente entendimento sobre esta norma preventiva.`;
        }

        return {
          questionId: item.questionId,
          quizId: item.quizId,
          meetingId: item.meetingId,
          quizTitle: item.quizTitle,
          questionText: item.questionText,
          totalAnswered: item.totalAnswered,
          correctCount: item.correctCount,
          errorCount: item.errorCount,
          errorRate,
          correctOptionText: item.correctOptionText,
          mostCommonWrongText: mostCommonWrong,
          fragilityLevel,
          actionPlan
        };
      })
      .sort((a, b) => b.errorRate - a.errorRate);

    // Ranking Geral de Colaboradores
    const participantsList = Array.from(participantAggregates.values())
      .map(p => ({
        ...p,
        avgScore: p.totalAttempts > 0 ? Math.round((p.totalScore / p.totalAttempts) * 10) / 10 : 0
      }))
      .sort((a, b) => {
        if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
        if (b.passedCount !== a.passedCount) return b.passedCount - a.passedCount;
        return b.totalAttempts - a.totalAttempts;
      });

    // Pódio dos Melhores Colaboradores
    const podium = {
      first: participantsList.filter((_, idx) => idx === 0),
      second: participantsList.filter((_, idx) => idx === 1),
      third: participantsList.filter((_, idx) => idx === 2)
    };

    // Desempenho dos DDS vinculados
    const ddsPerformanceList = Array.from(ddsPerformanceMap.values())
      .map(d => ({
        ...d,
        avgScore: d.attemptsCount > 0 ? Math.round((d.totalScore / d.attemptsCount) * 10) / 10 : 0,
        participationRate: d.attendeesCount > 0 ? Math.min(100, Math.round((d.attemptsCount / d.attendeesCount) * 100)) : 100
      }))
      .sort((a, b) => b.attemptsCount - a.attemptsCount);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      indicators: {
        totalQuizzesCreated,
        totalQuizzesPublished,
        totalQuizzesClosed,
        totalQuizzesInProgress,
        totalAttempts: totalAttemptsCount,
        uniqueParticipantsCount,
        overallAverageScore,
        approvalRate,
        criticalPerformancesCount: totalCriticalCount,
        participationRate
      },
      charts: {
        monthlyTimeline,
        scoreDistribution,
        quizzesComparison: analyzedQuizzes.map(q => ({
          id: q.id,
          title: q.title,
          averageScore: q.averageScore,
          approvalRate: q.approvalRate,
          totalAttempts: q.totalAttempts,
          status: q.status
        })),
        ddsPerformance: ddsPerformanceList
      },
      quizzes: analyzedQuizzes,
      fragilities: fragilityReports,
      criticalFragilitiesCount: fragilityReports.filter(f => f.fragilityLevel === 'CRITICAL').length,
      ranking: {
        podium,
        participants: participantsList
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });

  } catch (err) {
    console.error('Erro na API de BI de Questionários:', err);
    return jsonError('Falha ao processar inteligência analítica de questionários.', 500);
  }
}
