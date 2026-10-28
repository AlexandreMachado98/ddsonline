// lib/quizRanking.ts
// Módulo de Cálculo, Ordenação e Auditoria do Ranking de Desempenho dos Questionários do DDS Online

export interface RawAttempt {
  id: string;
  score: number;
  earnedPoints: number;
  possiblePoints: number;
  passed: boolean;
  level: string;
  submittedAt: string | Date;
  timeSpentSeconds?: number | null;
  participantName?: string | null;
  participantDoc?: string | null; // Usado para Função ou documento anonimizado
  participantRegistration?: string | null;
  attendance?: { id: string; name: string } | null;
  answers?: any[];
}

export interface QuizRankingItem {
  position: number;
  attemptId: string;
  participantName: string;
  participantRole: string;
  participantRegistration?: string | null;
  score: number;
  earnedPoints: number;
  possiblePoints: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  level: string;
  submittedAt: string;
  timeSpentSeconds?: number | null;
  timeSpentFormatted: string;
  isTie: boolean;
}

export interface QuizRankingPodium {
  first: QuizRankingItem[];
  second: QuizRankingItem[];
  third: QuizRankingItem[];
}

export interface QuizRankingSummary {
  quizId: string;
  quizTitle: string;
  totalParticipants: number;
  totalAttempts: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  approvedCount: number;
  insufficientCount: number;
  approvalRate: number;
  podium: QuizRankingPodium;
  ranking: QuizRankingItem[];
}

/**
 * Sanitiza o nome do participante para visualização pública e compatibilidade com LGPD
 * Ex: "Carlos Henrique Silva" -> "Carlos H. Silva"
 */
export function sanitizePublicName(fullName: string): string {
  if (!fullName) return 'Colaborador';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || 'Colaborador';
  if (parts.length === 2) return `${parts[0]} ${parts[1]}`;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const middle = parts.slice(1, -1).map(p => `${p[0].toUpperCase()}.`).join(' ');
  return `${first} ${middle} ${last}`;
}

/**
 * Formata o tempo de conclusão em segundos para visualização amigável
 * Ex: 45 -> "45s", 75 -> "1m 15s", 132 -> "2m 12s"
 */
export function formatTimeSpent(seconds?: number | null): string {
  if (typeof seconds !== 'number' || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
}

/**
 * Extrai a quantidade de acertos a partir das respostas gravadas ou da pontuação
 */
function extractCorrectCount(attempt: RawAttempt, fallbackTotal: number): number {
  if (Array.isArray(attempt.answers) && attempt.answers.length > 0) {
    return attempt.answers.filter(a => Boolean(a.correct)).length;
  }
  // Se não tiver breakdown de respostas, deduz a proporção por earnedPoints ou score
  if (attempt.possiblePoints > 0 && attempt.earnedPoints >= 0) {
    return attempt.earnedPoints;
  }
  if (fallbackTotal > 0 && attempt.score >= 0) {
    return Math.round((attempt.score / 100) * fallbackTotal);
  }
  return 0;
}

/**
 * Calcula o Ranking Inteligente de Desempenho com suporte a empate real compartilhado
 */
export function computeQuizRanking(
  attempts: RawAttempt[],
  totalQuestions: number,
  options?: {
    quizId?: string;
    quizTitle?: string;
    isPublicView?: boolean;
  }
): QuizRankingSummary {
  const quizId = options?.quizId || '';
  const quizTitle = options?.quizTitle || 'Avaliação de Segurança';
  const isPublicView = Boolean(options?.isPublicView);

  if (!Array.isArray(attempts) || attempts.length === 0) {
    return {
      quizId,
      quizTitle,
      totalParticipants: 0,
      totalAttempts: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      approvedCount: 0,
      insufficientCount: 0,
      approvalRate: 0,
      podium: { first: [], second: [], third: [] },
      ranking: []
    };
  }

  // 1. Filtragem e desduplicação por participante
  // Regra de Negócio: Um colaborador não pode ocupar várias posições por duplicidade
  const participantBestMap = new Map<string, { attempt: RawAttempt; correctCount: number }>();

  attempts.forEach(att => {
    // Normaliza nome do participante
    const rawName = (att.participantName || att.attendance?.name || 'Colaborador').trim();
    if (!rawName) return;

    const key = att.participantRegistration && /^\d{4}$/.test(att.participantRegistration)
      ? `matricula:${att.participantRegistration}` : `legado:${rawName.toLocaleLowerCase('pt-BR')}`;
    const correctCount = extractCorrectCount(att, totalQuestions);

    const existing = participantBestMap.get(key);
    if (!existing) {
      participantBestMap.set(key, { attempt: att, correctCount });
    } else {
      // Prioriza maior pontuação; se empate, maior quantidade de acertos; se empate, menor tempo
      const prevTime = typeof existing.attempt.timeSpentSeconds === 'number' && existing.attempt.timeSpentSeconds > 0 ? existing.attempt.timeSpentSeconds : Infinity;
      const currTime = typeof att.timeSpentSeconds === 'number' && att.timeSpentSeconds > 0 ? att.timeSpentSeconds : Infinity;

      const isBetter =
        att.score > existing.attempt.score ||
        (att.score === existing.attempt.score && correctCount > existing.correctCount) ||
        (att.score === existing.attempt.score && correctCount === existing.correctCount && currTime < prevTime);

      if (isBetter) {
        participantBestMap.set(key, { attempt: att, correctCount });
      }
    }
  });

  const uniqueCandidates = Array.from(participantBestMap.values());

  // 2. Ordenação rigorosa conforme regras de negócio
  // Critério 1: Maior percentual de aproveitamento (score)
  // Critério 2: Maior quantidade de acertos (correctCount / earnedPoints)
  // Critério 3: Menor tempo de conclusão (quem finalizou mais rápido desempata!)
  // Critério 4: Persistindo o empate exato, mantêm-se na mesma colocação
  uniqueCandidates.sort((a, b) => {
    if (b.attempt.score !== a.attempt.score) {
      return b.attempt.score - a.attempt.score;
    }
    if (b.correctCount !== a.correctCount) {
      return b.correctCount - a.correctCount;
    }
    const timeA = typeof a.attempt.timeSpentSeconds === 'number' && a.attempt.timeSpentSeconds > 0 ? a.attempt.timeSpentSeconds : Infinity;
    const timeB = typeof b.attempt.timeSpentSeconds === 'number' && b.attempt.timeSpentSeconds > 0 ? b.attempt.timeSpentSeconds : Infinity;
    if (timeA !== timeB) {
      return timeA - timeB; // Menor tempo de finalização vence o desempate
    }
    return 0; // Empate absoluto mantido se tudo for estritamente idêntico
  });

  // 3. Atribuição de Posição com Empate Compartilhado (Classificação de Competição 1224)
  const rankingItems: QuizRankingItem[] = [];

  for (let i = 0; i < uniqueCandidates.length; i++) {
    const current = uniqueCandidates[i];
    const prev = i > 0 ? uniqueCandidates[i - 1] : null;

    let position = i + 1;
    let isTie = false;

    const timeCurr = typeof current.attempt.timeSpentSeconds === 'number' && current.attempt.timeSpentSeconds > 0 ? current.attempt.timeSpentSeconds : null;
    const timePrev = prev && typeof prev.attempt.timeSpentSeconds === 'number' && prev.attempt.timeSpentSeconds > 0 ? prev.attempt.timeSpentSeconds : null;
    const isSameTime = timeCurr === timePrev;

    if (
      prev &&
      current.attempt.score === prev.attempt.score &&
      current.correctCount === prev.correctCount &&
      isSameTime
    ) {
      position = rankingItems[i - 1].position;
      isTie = true;
      rankingItems[i - 1].isTie = true;
    }

    const rawName = (current.attempt.participantName || current.attempt.attendance?.name || 'Colaborador').trim();
    const displayName = isPublicView ? sanitizePublicName(rawName) : rawName;
    const participantRole = (current.attempt.participantDoc || 'Colaborador').trim();

    rankingItems.push({
      position,
      attemptId: current.attempt.id,
      participantName: displayName,
      participantRole,
      participantRegistration: isPublicView ? null : current.attempt.participantRegistration || null,
      score: current.attempt.score,
      earnedPoints: current.attempt.earnedPoints ?? current.correctCount,
      possiblePoints: current.attempt.possiblePoints ?? totalQuestions,
      correctCount: current.correctCount,
      totalQuestions: totalQuestions > 0 ? totalQuestions : (current.attempt.possiblePoints || 1),
      passed: Boolean(current.attempt.passed),
      level: current.attempt.level || 'SATISFACTORY',
      submittedAt: current.attempt.submittedAt instanceof Date
        ? current.attempt.submittedAt.toISOString()
        : String(current.attempt.submittedAt || new Date().toISOString()),
      timeSpentSeconds: current.attempt.timeSpentSeconds ?? null,
      timeSpentFormatted: formatTimeSpent(current.attempt.timeSpentSeconds),
      isTie
    });
  }

  // 4. Montagem do Pódio Inteligente por Níveis de Desempenho
  // Agrupa os participantes pelas notas/acertos distintos para garantir destaque aos melhores
  const distinctScores = Array.from(new Set(rankingItems.map(r => r.score))).sort((a, b) => b - a);

  const firstPlace = rankingItems.filter(item => item.position === 1);

  // Se houver mais de um nível de nota, os colaboradores do 2º nível ganham destaque de Prata
  const secondPlace = rankingItems.some(item => item.position === 2)
    ? rankingItems.filter(item => item.position === 2)
    : distinctScores.length > 1
    ? rankingItems.filter(item => item.score === distinctScores[1])
    : [];

  // Se houver um 3º nível de nota, ganham destaque de Bronze
  const thirdPlace = rankingItems.some(item => item.position === 3)
    ? rankingItems.filter(item => item.position === 3)
    : distinctScores.length > 2
    ? rankingItems.filter(item => item.score === distinctScores[2])
    : [];

  const podium: QuizRankingPodium = {
    first: firstPlace,
    second: secondPlace,
    third: thirdPlace
  };

  // 5. Cálculo das métricas gerais
  const totalParticipants = rankingItems.length;
  const totalScoreSum = rankingItems.reduce((acc, curr) => acc + curr.score, 0);
  const averageScore = totalParticipants > 0 ? Math.round((totalScoreSum / totalParticipants) * 10) / 10 : 0;
  const approvedCount = rankingItems.filter(r => r.passed).length;
  const insufficientCount = totalParticipants - approvedCount;
  const approvalRate = totalParticipants > 0 ? Math.round((approvedCount / totalParticipants) * 100) : 0;

  const highestScore = totalParticipants > 0 ? Math.max(...rankingItems.map(r => r.score)) : 0;
  const lowestScore = totalParticipants > 0 ? Math.min(...rankingItems.map(r => r.score)) : 0;

  return {
    quizId,
    quizTitle,
    totalParticipants,
    totalAttempts: attempts.length,
    averageScore,
    highestScore,
    lowestScore,
    approvedCount,
    insufficientCount,
    approvalRate,
    podium,
    ranking: rankingItems
  };
}
