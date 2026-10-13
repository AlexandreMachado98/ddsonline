export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
export type PerformanceLevel = "EXCELLENT" | "SATISFACTORY" | "NEEDS_IMPROVEMENT" | "CRITICAL";
export interface QuizOption { id: string; text: string; correct: boolean }
export interface QuizQuestion { id: string; text: string; type: QuestionType; weight: number; options: QuizOption[]; explanation?: string }
export interface QuizAnswer { questionId: string; selectedOptionIds: string[] }
export interface QuestionResult { questionId: string; correct: boolean; earnedPoints: number; possiblePoints: number; correctOptionIds: string[]; selectedOptionIds: string[]; explanation?: string }
export interface QuizResult { score: number; earnedPoints: number; possiblePoints: number; correctCount: number; totalQuestions: number; passed: boolean; level: PerformanceLevel; questions: QuestionResult[] }
export interface QuizSettings { passingScore: number; criticalBelow: number; excellentFrom: number }

export function gradeQuiz(questions: QuizQuestion[], answers: QuizAnswer[], settings: QuizSettings): QuizResult {
  if (!questions.length) throw new Error("O questionário precisa ter ao menos uma pergunta.");
  if (![settings.passingScore, settings.criticalBelow, settings.excellentFrom].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) throw new Error("Limites de desempenho inválidos.");
  if (settings.criticalBelow > settings.passingScore || settings.excellentFrom < settings.passingScore) throw new Error("Os limites de desempenho estão inconsistentes.");
  const ids = new Set<string>();
  for (const question of questions) {
    if (!question.id || ids.has(question.id)) throw new Error("Identificador de pergunta inválido ou duplicado.");
    ids.add(question.id);
    if (!Number.isFinite(question.weight) || question.weight <= 0) throw new Error("O peso da pergunta deve ser positivo.");
    if (question.options.length < 2 || new Set(question.options.map(o => o.id)).size !== question.options.length) throw new Error("Alternativas inválidas.");
    const correct = question.options.filter(o => o.correct);
    if (!correct.length || (question.type !== "MULTIPLE_CHOICE" && correct.length !== 1)) throw new Error("Gabarito inválido.");
    if (question.type === "TRUE_FALSE" && question.options.length !== 2) throw new Error("Verdadeiro ou falso deve ter duas alternativas.");
  }
  const answerMap = new Map<string, string[]>();
  for (const answer of answers) {
    if (!ids.has(answer.questionId) || answerMap.has(answer.questionId)) throw new Error("Resposta desconhecida ou duplicada.");
    answerMap.set(answer.questionId, answer.selectedOptionIds);
  }
  const results = questions.map(question => {
    const selected = answerMap.get(question.id) ?? [];
    const valid = new Set(question.options.map(o => o.id));
    if (selected.some(id => !valid.has(id)) || new Set(selected).size !== selected.length) throw new Error("Alternativa desconhecida ou repetida.");
    const correctIds = question.options.filter(o => o.correct).map(o => o.id);
    const correct = selected.length === correctIds.length && selected.every(id => correctIds.includes(id));
    return { questionId: question.id, correct, earnedPoints: correct ? question.weight : 0, possiblePoints: question.weight, correctOptionIds: correctIds, selectedOptionIds: selected, explanation: question.explanation };
  });
  const possiblePoints = results.reduce((sum, q) => sum + q.possiblePoints, 0);
  const earnedPoints = results.reduce((sum, q) => sum + q.earnedPoints, 0);
  const score = Math.round((earnedPoints / possiblePoints) * 10000) / 100;
  const level: PerformanceLevel = score < settings.criticalBelow ? "CRITICAL" : score < settings.passingScore ? "NEEDS_IMPROVEMENT" : score >= settings.excellentFrom ? "EXCELLENT" : "SATISFACTORY";
  return { score, earnedPoints, possiblePoints, correctCount: results.filter(q => q.correct).length, totalQuestions: questions.length, passed: score >= settings.passingScore, level, questions: results };
}
