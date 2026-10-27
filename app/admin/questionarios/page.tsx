'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, Trash2, CheckCircle2, AlertTriangle, 
  Copy, Check, Clock, Award, RefreshCw, Bookmark, BookmarkCheck,
  TrendingUp, Users, Target, BarChart2, Star, RotateCcw,
  Sparkles, Layers, BookOpen, ChevronRight, FileText, Eye, X, ShieldAlert,
  ShieldCheck, Trophy, Loader2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'next/navigation';
import DdsLogo from '@/components/DdsLogo';
import QuizRankingView from '@/components/QuizRankingView';
import QuizBiDashboard from '@/components/QuizBiDashboard';
import AppShell from '@/components/layout/AppShell';

interface QuizOptionInput {
  id: string;
  text: string;
  correct: boolean;
}

interface QuizQuestionInput {
  id: string;
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  weight: number;
  options: QuizOptionInput[];
  explanation?: string;
}

interface MeetingOption {
  id: string;
  topic: string;
  farm: string;
  status: string;
  createdAt: string;
}

interface AttemptAnswerSummary {
  id: string;
  questionId: string;
  selectedOptionIds: string[];
  correct: boolean;
  earnedPoints: number;
}

interface AttemptSummary {
  id: string;
  score: number;
  earnedPoints?: number;
  possiblePoints?: number;
  passed: boolean;
  level: string;
  submittedAt: string;
  participantName?: string | null;
  participantDoc?: string | null;
  attendance?: {
    id: string;
    name: string;
  } | null;
  answers?: AttemptAnswerSummary[];
}

export interface QuestionBreakdownItem {
  questionId: string;
  questionText: string;
  selectedText: string;
  isCorrect: boolean;
  correctOptionText: string;
  explanation?: string;
}

export interface CollaboratorAttemptDetail {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  score: number;
  passed: boolean;
  level: string;
  submittedAt: string;
  answersCount: number;
  questionsBreakdown: QuestionBreakdownItem[];
}

export interface ParticipantDetail {
  name: string;
  role: string;
  count: number;
  totalScore: number;
  avgScore: number;
  passedCount: number;
  attempts: CollaboratorAttemptDetail[];
}

export interface QuestionFragilityItem {
  questionId: string;
  quizTitle: string;
  questionText: string;
  totalAnswered: number;
  correctCount: number;
  errorCount: number;
  errorRate: number;
  correctOptionText: string;
  mostCommonWrongText: string;
  fragilityLevel: 'CRITICAL' | 'MODERATE' | 'LOW';
  actionPlan: string;
}

interface ExistingQuiz {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  passingScore: number;
  criticalBelow: number;
  excellentFrom: number;
  shareToken: string;
  isTemplate?: boolean;
  templateId?: string | null;
  showRanking?: boolean;
  createdAt: string;
  publishedAt?: string;
  closedAt?: string;
  meetingId?: string | null;
  meeting?: {
    id: string;
    topic: string;
    farm: string;
    status: string;
  } | null;
  questions: any[];
  attempts: AttemptSummary[];
}

type ImportedQuestion = { text: string; options: { text: string; correct: boolean }[]; explanation?: string };

function parseCsvRows(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  const input = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(field.trim()); field = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += c;
  }
  if (quoted) throw new Error('CSV com aspas não fechadas.');
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function extractCsvQuestions(source: string): ImportedQuestion[] {
  const rows = parseCsvRows(source);
  if (rows.length < 2) throw new Error('O CSV precisa conter cabeçalho e perguntas.');
  const headers = rows[0].map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''));
  const col = (...names: string[]) => headers.findIndex(h => names.includes(h));
  const questionCol = col('pergunta', 'questao', 'enunciado');
  const answerCol = col('gabarito', 'resposta', 'respostacorreta');
  const explanationCol = col('explicacao', 'justificativa');
  const optionCols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(letter => col(letter, 'alternativa' + letter, 'opcao' + letter));
  if (questionCol < 0 || answerCol < 0 || optionCols.slice(0, 2).some(n => n < 0)) {
    throw new Error('Cabeçalhos necessários: Pergunta, Alternativa A, Alternativa B e Gabarito.');
  }
  return rows.slice(1).map((row, i) => {
    const text = (row[questionCol] || '').trim();
    const options = optionCols.flatMap((index, pos) => index < 0 || !row[index]?.trim() ? [] : [{ letter: 'ABCDEFGH'[pos], text: row[index].trim() }]);
    const answer = (row[answerCol] || '').trim().toUpperCase();
    if (!text || options.length < 2 || !options.some(o => o.letter === answer)) {
      throw new Error('Linha ' + (i + 2) + ': pergunta, alternativas ou gabarito inválido.');
    }
    return { text, options: options.map(o => ({ text: o.text, correct: o.letter === answer })), explanation: explanationCol < 0 ? '' : row[explanationCol] };
  });
}

function extractTxtQuestions(source: string): ImportedQuestion[] {
  const lines = source.replace(/\r/g, '').split('\n').map(line => line.trim()).filter(Boolean);
  const results: ImportedQuestion[] = [];
  let current: { text: string; options: { letter: string; text: string }[]; answer: string; explanation: string } | null = null;
  const finish = () => {
    if (!current) return;
    if (!current.text || current.options.length < 2 || !current.options.some(o => o.letter === current!.answer)) {
      throw new Error('Pergunta ' + (results.length + 1) + ' incompleta ou sem gabarito válido.');
    }
    results.push({ text: current.text, options: current.options.map(o => ({ text: o.text, correct: o.letter === current!.answer })), explanation: current.explanation });
  };
  for (const line of lines) {
    const question = line.match(/^(?:pergunta\s*)?\d+[.)\-:]\s*(.+)$/i);
    const option = line.match(/^([A-H])[.)\-:]\s*(.+)$/i);
    const answer = line.match(/^(?:gabarito|resposta(?:\s+correta)?)\s*[:\-]\s*([A-H])\s*$/i);
    const explanation = line.match(/^(?:explica[cç][aã]o|justificativa)\s*[:\-]\s*(.+)$/i);
    if (question) { finish(); current = { text: question[1], options: [], answer: '', explanation: '' }; }
    else if (option && current) current.options.push({ letter: option[1].toUpperCase(), text: option[2] });
    else if (answer && current) current.answer = answer[1].toUpperCase();
    else if (explanation && current) current.explanation = explanation[1];
  }
  finish();
  if (!results.length) throw new Error('Nenhuma pergunta encontrada. Use questões numeradas, alternativas A) e gabarito.');
  return results;
}


function QuestionariosContent() {
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();

  // Abas da tela: Avaliações Ativas, Ranking de Desempenho, Banco de Formulários, e Inteligência BI
  const [activeTab, setActiveTab] = useState<'QUIZZES' | 'TEMPLATES' | 'RANKING' | 'BI'>('QUIZZES');
  const [selectedRankingQuizId, setSelectedRankingQuizId] = useState<string>('');

  // Sincroniza aba e quiz da URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['QUIZZES', 'TEMPLATES', 'RANKING', 'BI'].includes(tab)) {
      setActiveTab(tab as any);
    }
    const qId = searchParams.get('quizId');
    if (qId) {
      setSelectedRankingQuizId(qId);
    }
  }, [searchParams]);

  // Reuniões
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('ALL');
  const [isLoadingMeetings, setIsLoadingMeetings] = useState<boolean>(true);

  // Questionários
  const [quizzes, setQuizzes] = useState<ExistingQuiz[]>([]);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState<boolean>(false);

  // Vínculo para a criação do NOVO questionário
  const [creationMeetingId, setCreationMeetingId] = useState<string>('');
  const [saveAsTemplate, setSaveAsTemplate] = useState<boolean>(true);

  // Estado do formulário de criação
  const [title, setTitle] = useState('');
  const [passingScore, setPassingScore] = useState(70);
  const [criticalBelow, setCriticalBelow] = useState(40);
  const [excellentFrom, setExcellentFrom] = useState(90);
  const [questions, setQuestions] = useState<QuizQuestionInput[]>([
    {
      id: crypto.randomUUID(),
      text: 'Qual a conduta preventiva adequada antes de operar equipamentos de alto risco?',
      type: 'SINGLE_CHOICE',
      weight: 1,
      options: [
        { id: crypto.randomUUID(), text: 'Inspecionar as condições de segurança e usar todos os EPIs recomendados', correct: true },
        { id: crypto.randomUUID(), text: 'Iniciar a operação imediatamente para evitar atrasos na produção', correct: false }
      ]
    }
  ]);

  // Feedbacks
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // 1. Carrega reuniões disponíveis
  const fetchMeetings = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      setIsLoadingMeetings(true);
      const res = await fetch(`/api/reuniao?organizerId=${currentUser.id}&_t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        const list: MeetingOption[] = [];
        if (data.activeMeeting) list.push(data.activeMeeting);
        if (Array.isArray(data.history)) {
          data.history.forEach((m: any) => {
            if (!list.some(item => item.id === m.id)) list.push(m);
          });
        }
        setMeetings(list);
      }
    } catch (e) {
      console.error('Erro ao buscar DDS:', e);
    } finally {
      setIsLoadingMeetings(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // 2. Carrega questionários
  const [allTemplates, setAllTemplates] = useState<ExistingQuiz[]>([]);
  const [, setIsLoadingTemplates] = useState<boolean>(false);
  const [attachingQuizId, setAttachingQuizId] = useState<string | null>(null);
  const [targetMeetingToAttach, setTargetMeetingToAttach] = useState<string>('');

  // 2. Carrega questionários com cache-busting
  const fetchQuizzes = useCallback(async (forcedFilter?: string) => {
    try {
      setIsLoadingQuizzes(true);
      const filterToUse = forcedFilter !== undefined ? forcedFilter : selectedMeetingId;
      const res = await fetch(`/api/questionarios?meetingId=${encodeURIComponent(filterToUse)}&_t=${Date.now()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.quizzes)) {
        setQuizzes(data.quizzes);
      } else {
        setQuizzes([]);
      }
    } catch (e) {
      console.error('Erro ao buscar questionários:', e);
      setQuizzes([]);
    } finally {
      setIsLoadingQuizzes(false);
    }
  }, [selectedMeetingId]);

  // Busca todos os formulários da biblioteca (templates)
  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoadingTemplates(true);
      const res = await fetch(`/api/questionarios?templates=true&_t=${Date.now()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.quizzes)) {
        setAllTemplates(data.quizzes);
      }
    } catch (e) {
      console.error('Erro ao buscar biblioteca de formulários:', e);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Formulários salvos (combina templates da biblioteca com os marcados na lista atual)
  const templateQuizzes = React.useMemo(() => {
    const map = new Map<string, ExistingQuiz>();
    allTemplates.forEach(t => map.set(t.id, t));
    quizzes.filter(q => q.isTemplate).forEach(q => map.set(q.id, q));
    return Array.from(map.values());
  }, [allTemplates, quizzes]);

  // Estado para Modal de Detalhes do Colaborador (Gabarito, Acertos e Erros)
  const [selectedCollaborator, setSelectedCollaborator] = useState<ParticipantDetail | null>(null);
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);

  const handleCopyActionPlan = (plan: string, qId: string) => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(plan);
    setCopiedPlanId(qId);
    setTimeout(() => setCopiedPlanId(null), 3000);
  };

  // Métricas de Business Intelligence (BI) e Diagnóstico de Fragilidades Operacionais
  const biMetrics = React.useMemo(() => {
    const totalQuizzesCount = quizzes.length;
    let totalAttemptsCount = 0;
    let totalScoreSum = 0;

    // Mapa de desempenho por Formulário/Questionário
    const formStats: Record<string, { title: string; count: number; totalScore: number; avgScore: number }> = {};

    // Mapa de desempenho detalhado por Colaborador
    const participantStats: Record<string, ParticipantDetail> = {};

    // Mapa de Fragilidades Operacionais por Questão
    const questionFragilityMap: Record<string, {
      questionId: string;
      quizTitle: string;
      questionText: string;
      totalAnswered: number;
      correctCount: number;
      errorCount: number;
      correctOptionText: string;
      wrongOptionsPicked: Record<string, number>;
    }> = {};

    quizzes.forEach(quiz => {
      const attempts = quiz.attempts || [];
      const formKey = quiz.templateId || quiz.id;
      if (!formStats[formKey]) {
        formStats[formKey] = { title: quiz.title, count: 0, totalScore: 0, avgScore: 0 };
      }

      attempts.forEach(att => {
        totalAttemptsCount++;
        totalScoreSum += att.score;

        // Stats do Form
        formStats[formKey].count++;
        formStats[formKey].totalScore += att.score;

        // Nome e Função do Colaborador
        const pName = (att.participantName || att.attendance?.name || 'Anônimo').trim();
        const pRole = (att.participantDoc || 'Função não informada').trim();

        if (!participantStats[pName]) {
          participantStats[pName] = {
            name: pName,
            role: pRole,
            count: 0,
            totalScore: 0,
            avgScore: 0,
            passedCount: 0,
            attempts: []
          };
        }
        if (participantStats[pName].role === 'Função não informada' && pRole !== 'Função não informada') {
          participantStats[pName].role = pRole;
        }

        participantStats[pName].count++;
        participantStats[pName].totalScore += att.score;
        if (att.passed) participantStats[pName].passedCount++;

        // Breakdown detalhado de cada pergunta respondida por este colaborador
        const answersList = att.answers || [];
        const questionsBreakdown: QuestionBreakdownItem[] = [];

        (quiz.questions || []).forEach(q => {
          const ans = answersList.find(a => a.questionId === q.id);
          const correctOpt = (q.options || []).find((o: any) => o.isCorrect || o.correct);
          const correctOptionText = correctOpt ? correctOpt.text : 'Gabarito não definido';

          let selectedText = 'Não respondeu';
          let isCorrect = false;

          if (ans) {
            isCorrect = Boolean(ans.correct);
            const selIds: string[] = Array.isArray(ans.selectedOptionIds) ? ans.selectedOptionIds : [];
            const selOpts = (q.options || []).filter((o: any) => selIds.includes(o.id));
            if (selOpts.length > 0) {
              selectedText = selOpts.map((o: any) => o.text).join('; ');
            }

            // Estatísticas globais de Fragilidade por Questão
            const qKey = q.id;
            if (!questionFragilityMap[qKey]) {
              questionFragilityMap[qKey] = {
                questionId: q.id,
                quizTitle: quiz.title,
                questionText: q.text,
                totalAnswered: 0,
                correctCount: 0,
                errorCount: 0,
                correctOptionText,
                wrongOptionsPicked: {}
              };
            }

            questionFragilityMap[qKey].totalAnswered++;
            if (isCorrect) {
              questionFragilityMap[qKey].correctCount++;
            } else {
              questionFragilityMap[qKey].errorCount++;
              if (selectedText !== 'Não respondeu') {
                questionFragilityMap[qKey].wrongOptionsPicked[selectedText] =
                  (questionFragilityMap[qKey].wrongOptionsPicked[selectedText] || 0) + 1;
              }
            }
          }

          questionsBreakdown.push({
            questionId: q.id,
            questionText: q.text,
            selectedText,
            isCorrect,
            correctOptionText,
            explanation: q.explanation
          });
        });

        participantStats[pName].attempts.push({
          attemptId: att.id,
          quizId: quiz.id,
          quizTitle: quiz.title,
          score: att.score,
          passed: att.passed,
          level: att.level,
          submittedAt: att.submittedAt,
          answersCount: answersList.length,
          questionsBreakdown
        });
      });
    });

    // Médias por formulário
    Object.values(formStats).forEach(f => {
      f.avgScore = f.count > 0 ? Math.round((f.totalScore / f.count) * 10) / 10 : 0;
    });

    // Médias por colaborador
    Object.values(participantStats).forEach(p => {
      p.avgScore = p.count > 0 ? Math.round((p.totalScore / p.count) * 10) / 10 : 0;
    });

    const overallAvg = totalAttemptsCount > 0 ? Math.round((totalScoreSum / totalAttemptsCount) * 10) / 10 : 0;

    // Rankings
    const sortedForms = Object.values(formStats).filter(f => f.count > 0).sort((a, b) => b.avgScore - a.avgScore);
    const topForm = sortedForms[0] || null;

    const sortedParticipants = Object.values(participantStats).filter(p => p.count > 0).sort((a, b) => b.avgScore - a.avgScore);
    const topParticipant = sortedParticipants[0] || null;

    // Relatório de Fragilidades Operacionais com Plano de Ação
    const fragilityReports: QuestionFragilityItem[] = Object.values(questionFragilityMap).map(item => {
      const errorRate = item.totalAnswered > 0
        ? Math.round((item.errorCount / item.totalAnswered) * 100)
        : 0;

      let mostCommonWrong = '';
      let maxCount = 0;
      Object.entries(item.wrongOptionsPicked).forEach(([text, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonWrong = text;
        }
      });

      const fragilityLevel: 'CRITICAL' | 'MODERATE' | 'LOW' =
        errorRate >= 50 ? 'CRITICAL' : errorRate >= 20 ? 'MODERATE' : 'LOW';

      let actionPlan = '';
      if (fragilityLevel === 'CRITICAL') {
        actionPlan = `🚨 PLANO DE AÇÃO IMEDIATO (${errorRate}% DE ERRO NA OPERAÇÃO):\n` +
          `• Assunto: ${item.questionText}\n` +
          `• Desvio Identificado: A equipe está errando esta conduta preventiva (resposta comum: "${mostCommonWrong || 'desvio operacional'}").\n` +
          `• Ação Corretiva: Realizar DDS prático de reciclagem e reforçar que a conduta obrigatória é: "${item.correctOptionText}".\n` +
          `• Responsável: Técnico de Segurança / Encarregado de Campo.`;
      } else if (fragilityLevel === 'MODERATE') {
        actionPlan = `⚠️ PLANO DE AÇÃO DE ALINHAMENTO (${errorRate}% DE ERRO):\n` +
          `• Assunto: ${item.questionText}\n` +
          `• Ação Recomendada: Incluir este ponto na pauta do próximo DDS semanal para esclarecer dúvidas e padronizar o procedimento correto ("${item.correctOptionText}").`;
      } else {
        actionPlan = `✅ PROCEDIMENTO CONSOLIDADO (${item.correctCount}/${item.totalAnswered} acertos):\n` +
          `• A equipe demonstrou pleno domínio sobre esta regra de segurança. Manter observações comportamentais na rotina.`;
      }

      return {
        questionId: item.questionId,
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
    }).sort((a, b) => b.errorRate - a.errorRate);

    const criticalFragilities = fragilityReports.filter(f => f.fragilityLevel === 'CRITICAL');

    return {
      totalQuizzesCount,
      totalAttemptsCount,
      overallAvg,
      topForm,
      topParticipant,
      rankingForms: sortedForms.slice(0, 5),
      rankingParticipants: sortedParticipants,
      participantStats,
      fragilityReports,
      criticalFragilitiesCount: criticalFragilities.length
    };
  }, [quizzes]);

  // Questionário ativo selecionado para o Ranking Inteligente
  const selectedRankingQuiz = React.useMemo(() => {
    if (selectedRankingQuizId) {
      const found = quizzes.find(q => q.id === selectedRankingQuizId);
      if (found) return found;
    }
    // Se não tiver selecionado ou não achar, prioriza questionário com respostas
    const withAttempts = quizzes.find(q => q.attempts && q.attempts.length > 0);
    return withAttempts || (quizzes.length > 0 ? quizzes[0] : null);
  }, [quizzes, selectedRankingQuizId]);

  // Abre modal de gabarito a partir do ranking
  const handleOpenCollaboratorByName = (collabName: string) => {
    if (!collabName || !biMetrics?.participantStats) return;
    const detail = biMetrics.participantStats[collabName.trim()];
    if (detail) {
      setSelectedCollaborator(detail);
    }
  };

  const [isImporting, setIsImporting] = useState(false);
  const handleImportFile = async (file?: File) => {
    if (!file) return;
    setStatusMessage(null);
    if (file.size === 0) {
      setStatusMessage({ type: 'error', text: 'O arquivo está vazio.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'Arquivo acima do limite de 5 MB.' });
      return;
    }
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'txt', 'pdf', 'docx', 'xlsx'].includes(extension || '')) {
      setStatusMessage({ type: 'error', text: 'Formato não suportado. Utilize CSV, TXT, PDF, DOCX ou XLSX.' });
      return;
    }
    setIsImporting(true);
    try {
      let parsed: ImportedQuestion[];
      if (extension === 'csv' || extension === 'txt') {
        const content = await file.text();
        parsed = extension === 'csv' ? extractCsvQuestions(content) : extractTxtQuestions(content);
      } else {
        const form = new FormData();
        form.append('file', file);
        const response = await fetch('/api/questionarios/importar', { method: 'POST', body: form });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Falha ao extrair arquivo.');
        parsed = data.questions;
      }
      if (!parsed.length || parsed.length > 100) throw new Error('O arquivo deve conter de 1 a 100 perguntas.');
      const converted: QuizQuestionInput[] = parsed.map(q => ({
        id: crypto.randomUUID(), text: q.text, type: 'SINGLE_CHOICE', weight: 1,
        explanation: q.explanation,
        options: q.options.map(o => ({ id: crypto.randomUUID(), text: o.text, correct: o.correct }))
      }));
      if (!window.confirm('Substituir as perguntas atualmente no editor pelas ' + converted.length + ' perguntas importadas? Alterações não salvas serão perdidas.')) return;
      setQuestions(converted);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 150));
      setStatusMessage({ type: 'success', text: parsed.length + ' perguntas extraídas. Revise todas as questões e gabaritos antes de salvar. O arquivo original não foi armazenado no banco.' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: error instanceof Error ? error.message : 'Não foi possível interpretar o arquivo.' });
    } finally { setIsImporting(false); }
  };


  // Manipuladores de perguntas e alternativas
  const handleAddQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: '',
        type: 'SINGLE_CHOICE',
        weight: 1,
        options: [
          { id: crypto.randomUUID(), text: '', correct: true },
          { id: crypto.randomUUID(), text: '', correct: false }
        ]
      }
    ]);
  };

  const handleRemoveQuestion = (id: string) => {
    if (questions.length <= 1) {
      setStatusMessage({ type: 'error', text: 'O questionário deve ter no mínimo uma pergunta.' });
      return;
    }
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleUpdateQuestion = (id: string, patch: Partial<QuizQuestionInput>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  };

  const handleAddOption = (questionId: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q;
      if (q.options.length >= 8) {
        setStatusMessage({ type: 'error', text: 'Limite máximo de 8 alternativas por questão.' });
        return q;
      }
      return {
        ...q,
        options: [...q.options, { id: crypto.randomUUID(), text: '', correct: false }]
      };
    }));
  };

  const handleRemoveOption = (questionId: string, optionId: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q;
      if (q.options.length <= 2) {
        setStatusMessage({ type: 'error', text: 'A questão deve conter no mínimo 2 alternativas.' });
        return q;
      }
      const filtered = q.options.filter(o => o.id !== optionId);
      if (!filtered.some(o => o.correct) && filtered.length > 0) {
        filtered[0].correct = true;
      }
      return { ...q, options: filtered };
    }));
  };

  const handleOptionChange = (questionId: string, optionId: string, text: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q;
      return {
        ...q,
        options: q.options.map(o => o.id === optionId ? { ...o, text } : o)
      };
    }));
  };

  const handleSetCorrect = (questionId: string, optionId: string, isMultiple: boolean) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q;
      if (isMultiple) {
        return {
          ...q,
          options: q.options.map(o => o.id === optionId ? { ...o, correct: !o.correct } : o)
        };
      } else {
        return {
          ...q,
          options: q.options.map(o => ({ ...o, correct: o.id === optionId }))
        };
      }
    }));
  };

  // Carregar perguntas de um Formulário Reutilizável no editor
  const handleLoadTemplate = (template: ExistingQuiz) => {
    setTitle(`${template.title} (Reutilizado)`);
    setPassingScore(template.passingScore);
    setCriticalBelow(template.criticalBelow);
    setExcellentFrom(template.excellentFrom);
    if (template.questions && template.questions.length > 0) {
      setQuestions(template.questions.map(q => ({
        id: crypto.randomUUID(),
        text: q.text,
        type: q.type,
        weight: q.weight,
        options: q.options.map((o: any) => ({
          id: crypto.randomUUID(),
          text: o.text,
          correct: Boolean(o.isCorrect)
        })),
        explanation: q.explanation || undefined
      })));
    }
    setActiveTab('QUIZZES');
    setStatusMessage({ type: 'success', text: `Formulário "${template.title}" carregado no editor! Você pode editar e salvar.` });
  };

  // Desvincular DIRETAMENTE o questionário do DDS atual (sem criar cópia, alterando o próprio questionário para autônomo)
  const handleDetachMeeting = async (quiz: ExistingQuiz) => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/questionarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: quiz.id,
          detachMeeting: true
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Questionário "${quiz.title}" desvinculado com sucesso! Ele agora é uma Avaliação Autônoma permanente e permanece salvo no sistema.`
        });
        setSelectedMeetingId('ALL');
        await fetchQuizzes('ALL');
        await fetchTemplates();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Erro ao desvincular do DDS.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Falha de comunicação com o servidor.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Vincular questionário autônomo a um DDS
  const handleAttachMeeting = async (quizId: string, meetingId: string) => {
    if (!meetingId) return;
    try {
      setIsSaving(true);
      const res = await fetch('/api/questionarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: quizId,
          meetingId
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: 'Questionário vinculado ao DDS com sucesso!'
        });
        setAttachingQuizId(null);
        setTargetMeetingToAttach('');
        await fetchQuizzes();
        await fetchTemplates();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Erro ao vincular ao DDS.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Falha de comunicação com o servidor.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Excluir avaliação
  const handleDeleteQuiz = async (quizId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta avaliação? Esta ação removerá o questionário.')) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/questionarios?id=${encodeURIComponent(quizId)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Avaliação excluída com sucesso!' });
        await fetchQuizzes();
        await fetchTemplates();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Erro ao excluir avaliação.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Falha de comunicação com o servidor.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Copiar qualquer questionário diretamente para o Banco de Formulários
  const handleSaveToFormBank = async (quiz: ExistingQuiz) => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/questionarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clone',
          sourceQuizId: quiz.id,
          title: `${quiz.title} (Modelo)`,
          isTemplate: true,
          meetingId: null
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Formulário copiado e guardado com sucesso no seu Banco de Formulários!`
        });
        fetchQuizzes();
        setActiveTab('TEMPLATES');
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Erro ao salvar no Banco de Formulários.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Falha de comunicação com o servidor.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Reabrir Avaliação para Reavaliação (Gera nova rodada de aplicação)
  const handleReevaluate = async (quiz: ExistingQuiz) => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/questionarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reopen',
          sourceQuizId: quiz.id,
          title: `${quiz.title} • Reavaliação / 2ª Rodada`,
          meetingId: creationMeetingId || null
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Nova rodada de reavaliação iniciada com sucesso! O link já está ativo.`
        });
        fetchQuizzes();
        setActiveTab('QUIZZES');
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Erro ao reabrir reavaliação.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Falha de comunicação com o servidor.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Alternar se um questionário é Template
  const handleToggleTemplate = async (quizId: string, current: boolean) => {
    try {
      const res = await fetch('/api/questionarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: quizId, toggleTemplate: !current })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: !current ? 'Questionário salvo na sua biblioteca de Formulários!' : 'Removido da biblioteca de Formulários.'
        });
        fetchQuizzes();
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Erro ao atualizar biblioteca de formulários.' });
    }
  };

  // Salvar novo questionário no banco
  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!title.trim()) {
      setStatusMessage({ type: 'error', text: 'Defina um título para a avaliação.' });
      return;
    }

    // Validações
    for (const [idx, q] of questions.entries()) {
      if (!q.text.trim()) {
        setStatusMessage({ type: 'error', text: `Preencha o enunciado da pergunta ${idx + 1}.` });
        return;
      }
      if (q.options.some(o => !o.text.trim())) {
        setStatusMessage({ type: 'error', text: `Preencha o texto de todas as alternativas da pergunta ${idx + 1}.` });
        return;
      }
      if (!q.options.some(o => o.correct)) {
        setStatusMessage({ type: 'error', text: `Marque ao menos uma alternativa correta na pergunta ${idx + 1}.` });
        return;
      }
    }

    try {
      setIsSaving(true);
      const res = await fetch('/api/questionarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: creationMeetingId || null,
          title: title.trim(),
          passingScore,
          criticalBelow,
          excellentFrom,
          isTemplate: saveAsTemplate,
          questions
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ 
          type: 'success', 
          text: saveAsTemplate
            ? 'Avaliação salva com sucesso e armazenada na sua biblioteca de Formulários para futuras reutilizações!'
            : 'Questionário criado com sucesso no banco de dados!'
        });
        setTitle('');
        fetchQuizzes();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Erro ao salvar questionário.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Falha de comunicação com o servidor.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Alterar status
  const handleUpdateStatus = async (quizId: string, nextStatus: 'PUBLISHED' | 'CLOSED') => {
    try {
      const res = await fetch('/api/questionarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: quizId, status: nextStatus })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: nextStatus === 'PUBLISHED' 
            ? 'Questionário publicado! Link liberado para os colaboradores.' 
            : 'Questionário finalizado com sucesso. Você pode reabri-lo para reavaliação a qualquer momento.'
        });
        fetchQuizzes();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Não foi possível alterar o status.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Erro ao conectar ao servidor.' });
    }
  };

  const handleCopyLink = (shareToken: string) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/questionario/${shareToken}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(shareToken);
    setTimeout(() => setCopiedToken(null), 3000);
  };

  const scrollToCreateQuiz = () => {
    setActiveTab('QUIZZES');
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        document.getElementById('create-quiz-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Painel Geral', href: '/admin' },
        { label: 'Questionários & Avaliações' }
      ]}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={scrollToCreateQuiz}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Nova Avaliação</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        
        {/* Abas de Navegação Segmentadas */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 flex-wrap">
          <div className="inline-flex p-1 bg-white border border-slate-200/90 rounded-2xl shadow-sm gap-1 overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('QUIZZES')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'QUIZZES'
                  ? 'bg-[#0F1F38] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Award size={15} />
              <span>Avaliações ({quizzes.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('RANKING')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'RANKING'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-amber-800 hover:text-amber-950 hover:bg-amber-50'
              }`}
            >
              <Trophy size={15} />
              <span>Ranking & Pódio</span>
            </button>

            <button
              onClick={() => setActiveTab('TEMPLATES')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'TEMPLATES'
                  ? 'bg-[#0F1F38] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers size={15} />
              <span>Modelos NR ({templateQuizzes.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('BI')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'BI'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-blue-700 hover:text-blue-900 hover:bg-blue-50'
              }`}
            >
              <BarChart2 size={15} />
              <span>Inteligência BI</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={scrollToCreateQuiz}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Criar Questionário</span>
            </button>
          </div>
        </div>

        {/* Feedback de Status */}
        {statusMessage && (
          <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 border ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 1: AVALIAÇÕES & PROVAS                                               */}
        {/* ========================================================================= */}
        {activeTab === 'QUIZZES' && (
          <div className="space-y-6">
            
            {/* Banner de Acesso Rápido ao Ranking */}
            <div className="bg-gradient-to-r from-amber-50 via-amber-50/40 to-white border border-amber-200/90 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600 shrink-0 shadow-sm">
                  <Trophy size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
                      Novo Recurso
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900">
                      Ranking Inteligente & Pódio dos Colaboradores
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Consulte a classificação em tempo real, pódio Ouro/Prata/Bronze, empates compartilhados e exporte o relatório oficial em PDF.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('RANKING')}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Trophy size={15} />
                <span>Ver Ranking & Pódio</span>
              </button>
            </div>

            {/* Barra de Filtro */}
            <section className="bg-white border border-slate-200/90 p-4 rounded-2xl space-y-2 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Filtrar Avaliações em Andamento
                </label>
                <span className="text-[11px] text-slate-500">
                  Total encontrado: <strong className="text-blue-600 font-bold">{quizzes.length}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={selectedMeetingId}
                  onChange={e => setSelectedMeetingId(e.target.value)}
                  className="w-full sm:col-span-2 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-3 text-xs text-slate-800 font-semibold focus:bg-white focus:border-blue-600 outline-none min-h-[44px]"
                >
                  <option value="ALL">📁 Todas as Avaliações (Autônomas e Vinculadas a DDS)</option>
                  <option value="NONE">✨ Apenas Avaliações Autônomas (Sem vínculo)</option>
                  {meetings.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.status === 'LIVE' ? '🟢 AO VIVO: ' : '📋 DDS: '} {m.topic} — {m.farm || 'Sem local'}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => fetchQuizzes()}
                  disabled={isLoadingQuizzes}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-200 min-h-[44px] cursor-pointer"
                >
                  <RefreshCw size={14} className={isLoadingQuizzes ? 'animate-spin text-blue-600' : ''} />
                  <span>Atualizar Lista</span>
                </button>
              </div>
            </section>

            {/* Listagem de Questionários com Ações de Reavaliação e Salvar Formulário */}
            <section className="bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-blue-600" />
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Avaliações Cadastradas ({quizzes.length})
                  </h2>
                </div>
              </div>

              {isLoadingQuizzes ? (
                <p className="text-xs text-slate-400 py-3">Buscando avaliações...</p>
              ) : quizzes.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">Nenhum questionário encontrado. Crie uma nova avaliação abaixo.</p>
              ) : (
                <div className="space-y-3">
                  {quizzes.map(q => (
                    <div key={q.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                              q.status === 'PUBLISHED' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                              q.status === 'CLOSED' ? 'bg-slate-800 border-slate-700 text-slate-400' :
                              'bg-amber-500/15 border-amber-500/30 text-amber-300'
                            }`}>
                              {q.status === 'PUBLISHED' ? 'Ativo / Publicado' : q.status === 'CLOSED' ? 'Encerrado' : 'Rascunho'}
                            </span>
                            
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                              {q.meeting?.topic ? `Vinculado: ${q.meeting.topic}` : '✨ Autônomo'}
                            </span>

                            {q.isTemplate && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center gap-1">
                                <BookmarkCheck size={11} /> Formulário Base
                              </span>
                            )}

                            <h3 className="text-sm font-bold text-white">{q.title}</h3>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Nota Mínima: {q.passingScore}% • Total de Questões: {q.questions?.length || 0} • Respostas: {q.attempts?.length || 0}
                          </p>
                        </div>

                        {/* Ações Rápidas */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Se for vinculado a um DDS, permite desvincular a qualquer momento */}
                          {q.meetingId ? (
                            <button
                              onClick={() => handleDetachMeeting(q)}
                              disabled={isSaving}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                              title="Desvincular este questionário do DDS para transformá-lo em uma Avaliação Autônoma permanente"
                            >
                              <Sparkles size={12} className="text-amber-400" />
                              <span>Desvincular do DDS</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {attachingQuizId === q.id ? (
                                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-700">
                                  <select
                                    value={targetMeetingToAttach}
                                    onChange={e => setTargetMeetingToAttach(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white outline-none"
                                  >
                                    <option value="">Selecione o DDS...</option>
                                    {meetings.map(m => (
                                      <option key={m.id} value={m.id}>
                                        {m.topic}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleAttachMeeting(q.id, targetMeetingToAttach)}
                                    disabled={!targetMeetingToAttach || isSaving}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded cursor-pointer"
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    onClick={() => { setAttachingQuizId(null); setTargetMeetingToAttach(''); }}
                                    className="px-1.5 py-1 text-slate-400 hover:text-white text-xs cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setAttachingQuizId(q.id)}
                                  disabled={isSaving}
                                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                  title="Vincular esta avaliação autônoma a um DDS específico"
                                >
                                  <Layers size={12} className="text-slate-400" />
                                  <span>Vincular a um DDS</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Ver Ranking Oficial e Pódio */}
                          <button
                            onClick={() => {
                              setSelectedRankingQuizId(q.id);
                              setActiveTab('RANKING');
                            }}
                            className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                            title="Ver Ranking Oficial e Pódio desta Avaliação"
                          >
                            <Trophy size={12} className="text-amber-400" />
                            <span>Ranking & Pódio</span>
                          </button>

                          {/* Copiar para o Banco de Formulários */}
                          <button
                            onClick={() => handleSaveToFormBank(q)}
                            disabled={isSaving}
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                            title="Copiar e guardar este modelo diretamente no Banco de Formulários para reutilizar quando quiser"
                          >
                            <Bookmark size={12} className="text-cyan-400" />
                            <span>Jogar no Banco de Formulários</span>
                          </button>

                          {q.status === 'DRAFT' && (
                            <button
                              onClick={() => handleUpdateStatus(q.id, 'PUBLISHED')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-lg transition-all cursor-pointer"
                            >
                              Publicar Avaliação
                            </button>
                          )}

                          {q.status === 'PUBLISHED' && (
                            <>
                              <button
                                onClick={() => handleCopyLink(q.shareToken)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                {copiedToken === q.shareToken ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                <span>{copiedToken === q.shareToken ? 'Link Copiado!' : 'Copiar Link'}</span>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(q.id, 'CLOSED')}
                                className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer"
                              >
                                Encerrar
                              </button>
                            </>
                          )}

                          {/* REAVALIAÇÃO: Se o questionário foi finalizado, permite reabrir/gerar nova rodada */}
                          {q.status === 'CLOSED' && (
                            <button
                              onClick={() => handleReevaluate(q)}
                              disabled={isSaving}
                              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-slate-950 font-black text-xs rounded-lg transition-all flex items-center gap-1 shadow-md cursor-pointer"
                              title="Reabrir este questionário para aplicar uma nova rodada de avaliação à equipe"
                            >
                              <RotateCcw size={13} />
                              <span>Aplicar Reavaliação</span>
                            </button>
                          )}

                          {/* Excluir Avaliação */}
                          <button
                            onClick={() => handleDeleteQuiz(q.id)}
                            disabled={isSaving}
                            className="p-1.5 text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-500/20 rounded-lg transition-colors cursor-pointer"
                            title="Excluir esta avaliação"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Resumo de Respostas dos Participantes */}
                      {q.attempts && q.attempts.length > 0 && (
                        <div className="pt-2 border-t border-slate-800/80">
                          <p className="text-[11px] font-bold text-slate-300 mb-2">Desempenho dos Participantes:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {q.attempts.map(att => (
                              <div key={att.id} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-[11px] flex items-center justify-between">
                                <span className="font-semibold text-slate-200 truncate pr-2">
                                  {att.participantName || att.attendance?.name || 'Participante'}
                                </span>
                                <span className={`font-black shrink-0 ${att.passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {att.score}% ({att.passed ? 'Aprovado' : 'Abaixo'})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Criador de Questionários */}
            <section id="create-quiz-section" className="bg-white border border-slate-200/80 p-5 sm:p-8 rounded-3xl shadow-sm space-y-6 text-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Plus size={18} className="text-blue-600" />
                <h2 className="text-sm sm:text-base font-black text-[#0F1F38] uppercase tracking-wider">
                  Criar Nova Avaliação de Segurança
                </h2>
              </div>

              <form onSubmit={handleSaveQuiz} className="space-y-6">
                
                {/* Vínculo Opcional */}
                <div className="space-y-1.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Vínculo a um DDS (Opcional)</span>
                    <span className="text-[10px] text-blue-600 font-semibold lowercase">opcional</span>
                  </label>
                  <select
                    value={creationMeetingId}
                    onChange={e => setCreationMeetingId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-3 text-xs text-slate-800 font-semibold focus:border-blue-600 outline-none"
                  >
                    <option value="">✨ Criar como Avaliação Autônoma (Sem vincular a DDS)</option>
                    {meetings.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.status === 'LIVE' ? '🟢 AO VIVO: ' : '📋 '} {m.topic} — {m.farm || 'Sem local'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Título da Avaliação
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ex: Avaliação de Percepção de Risco - NR-35 Trabalho em Altura"
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-800 font-semibold focus:border-blue-600 outline-none"
                    required
                  />
                </div>

                {/* Opção para Salvar como Formulário Reutilizável */}
                <div className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900">
                  <input
                    type="checkbox"
                    id="saveTemplateCheck"
                    checked={saveAsTemplate}
                    onChange={e => setSaveAsTemplate(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700"
                  />
                  <label htmlFor="saveTemplateCheck" className="text-xs text-emerald-900 font-medium cursor-pointer select-none">
                    <strong>Salvar também no Banco de Formulários</strong> (permite reutilizar e aplicar reavaliações no futuro)
                  </label>
                </div>

                {/* Parâmetros */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase">
                      Média de Aprovação (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={passingScore}
                      onChange={e => setPassingScore(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:border-blue-600 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase">
                      Alerta Crítico Abaixo de (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={passingScore}
                      value={criticalBelow}
                      onChange={e => setCriticalBelow(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:border-blue-600 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase">
                      Excelente a partir de (%)
                    </label>
                    <input
                      type="number"
                      min={passingScore}
                      max="100"
                      value={excellentFrom}
                      onChange={e => setExcellentFrom(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:border-blue-600 outline-none"
                    />
                  </div>
                </div>

        <section className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
          <h2 className="text-base font-bold text-white">Importar perguntas de arquivo</h2>
          <p className="text-xs text-slate-400">Importe CSV, TXT, PDF, DOCX ou XLSX. CSV e TXT são lidos no navegador; PDF, Word e Excel são processados temporariamente no servidor, sem armazenamento do original. Revise o gabarito antes de salvar.</p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold text-white">
            <FileText size={16} /> {isImporting ? 'Lendo arquivo...' : 'Selecionar arquivo'}
            <input type="file" accept=".csv,.txt,.pdf,.docx,.xlsx,text/csv,text/plain,application/pdf" className="sr-only" disabled={isImporting}
              onChange={async e => { await handleImportFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <p className="text-xs text-slate-500">CSV: Pergunta, Alternativa A, Alternativa B, Alternativa C, Alternativa D, Gabarito (A/B/C/D). TXT: 1. Pergunta / A) opção / B) opção / Gabarito: B. Limite: 5 MB e 100 questões.</p>
        </section>


                {/* Perguntas */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Perguntas ({questions.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl transition-all border border-slate-700 flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Adicionar Pergunta
                    </button>
                  </div>

                  {questions.map((q, qIndex) => (
                    <div key={q.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className="text-xs font-black text-blue-600">
                          Questão {qIndex + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(q.id)}
                          className="text-rose-400 hover:text-rose-300 p-1 text-xs flex items-center gap-1 font-semibold"
                        >
                          <Trash2 size={13} /> Remover
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-400">Enunciado</label>
                        <textarea
                          rows={2}
                          value={q.text}
                          onChange={e => handleUpdateQuestion(q.id, { text: e.target.value })}
                          placeholder="Enunciado da pergunta de segurança..."
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-blue-600 outline-none"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-400">Tipo de Resposta</label>
                          <select
                            value={q.type}
                            onChange={e => handleUpdateQuestion(q.id, { type: e.target.value as any })}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-blue-600 outline-none"
                          >
                            <option value="SINGLE_CHOICE">Escolha Única (Uma Correta)</option>
                            <option value="MULTIPLE_CHOICE">Múltipla Escolha (Mais de uma)</option>
                            <option value="TRUE_FALSE">Verdadeiro ou Falso</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-400">Peso / Pontos</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={q.weight}
                            onChange={e => handleUpdateQuestion(q.id, { weight: Number(e.target.value) })}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-blue-600 outline-none"
                          />
                        </div>
                      </div>

                      {/* Alternativas */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400">Alternativas e Gabarito:</span>
                          <button
                            type="button"
                            onClick={() => handleAddOption(q.id)}
                            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
                          >
                            + Nova Alternativa
                          </button>
                        </div>

                        <div className="space-y-2">
                          {q.options.map(opt => (
                            <div key={opt.id} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSetCorrect(q.id, opt.id, q.type === 'MULTIPLE_CHOICE')}
                                className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                                  opt.correct 
                                    ? 'bg-emerald-600 border-emerald-500 text-white' 
                                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                                }`}
                                title={opt.correct ? 'Alternativa Correta (Gabarito)' : 'Marcar como Correta'}
                              >
                                {opt.correct ? <Check size={14} /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
                              </button>
                              <input
                                type="text"
                                value={opt.text}
                                onChange={e => handleOptionChange(q.id, opt.id, e.target.value)}
                                placeholder="Texto da alternativa..."
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(q.id, opt.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                                title="Excluir alternativa"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 disabled:opacity-50 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" /> Salvando Avaliação...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Salvar e Criar Avaliação
                    </>
                  )}
                </button>
              </form>
            </section>

          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA: RANKING INTELIGENTE DE DESEMPENHO E PÓDIO                            */}
        {/* ========================================================================= */}
        {activeTab === 'RANKING' && (
          <div className="space-y-6">
            
            {/* Barra de Seleção e Filtro de Questionário */}
            <div className="bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 flex items-center gap-1.5 font-bold">
                  <Trophy size={13} className="text-amber-500" /> Auditoria de Classificação Oficial
                </span>
                <h3 className="text-sm font-extrabold text-slate-900">Selecione a Avaliação para Auditar o Ranking:</h3>
                <p className="text-xs text-slate-500">
                  Consulte os melhores desempenhos, empate compartilhado e exporte o relatório oficial.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="relative">
                  <select
                    value={selectedRankingQuiz?.id || ''}
                    onChange={e => setSelectedRankingQuizId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold focus:border-amber-500 outline-none w-full sm:w-80 cursor-pointer"
                  >
                    {quizzes.length === 0 ? (
                      <option value="">Nenhuma avaliação criada ainda</option>
                    ) : (
                      quizzes.map(q => (
                        <option key={q.id} value={q.id}>
                          {q.status === 'PUBLISHED' ? '🟢 ' : q.status === 'CLOSED' ? '⏹️ ' : '📝 '}
                          {q.title} ({q.attempts?.length || 0} respostas) {q.meeting?.topic ? `• DDS: ${q.meeting.topic}` : '• Autônomo'}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('QUIZZES')}
                  className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Voltar às Provas</span>
                </button>
              </div>
            </div>

            {/* Componente Modular do Ranking */}
            {selectedRankingQuiz ? (
              <QuizRankingView
                key={selectedRankingQuiz.id}
                quizId={selectedRankingQuiz.id}
                quizTitle={selectedRankingQuiz.title}
                passingScore={selectedRankingQuiz.passingScore}
                ddsTopic={selectedRankingQuiz.meeting?.topic}
                ddsFarm={selectedRankingQuiz.meeting?.farm}
                initialShowRanking={selectedRankingQuiz.showRanking}
                shareToken={selectedRankingQuiz.shareToken}
                organizerName={currentUser?.name || 'Técnico de Segurança'}
                companyName={currentUser?.company || 'DDS Online'}
                onOpenCollaboratorModal={handleOpenCollaboratorByName}
              />
            ) : (
              <div className="p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
                  <Trophy size={32} />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h3 className="text-base font-black text-white">Nenhuma Avaliação Disponível</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você ainda não possui questionários cadastrados. Acesse a aba Avaliações para criar sua primeira prova de treinamento ou DDS.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('QUIZZES')}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <Plus size={14} /> Criar Nova Avaliação
                </button>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: BANCO DE FORMULÁRIOS (TEMPLATES REUTILIZÁVEIS)                     */}
        {/* ========================================================================= */}
        {activeTab === 'TEMPLATES' && (
          <section className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-emerald-400" />
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">
                    Banco de Formulários Salvos ({templateQuizzes.length})
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Seus modelos de questionários prontos para serem reutilizados em qualquer novo DDS ou treinamento.
                </p>
              </div>
            </div>

            {templateQuizzes.length === 0 ? (
              <div className="p-8 text-center space-y-3 bg-slate-950 rounded-2xl border border-slate-800">
                <BookOpen size={36} className="mx-auto text-slate-600" />
                <h3 className="text-sm font-bold text-white">Nenhum formulário arquivado ainda</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Ao criar um questionário, mantenha a opção "Salvar no Banco de Formulários" marcada ou clique no botão de marcador para guardar seus modelos favoritos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templateQuizzes.map(tpl => (
                  <div key={tpl.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 hover:border-slate-700 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-md border border-cyan-500/20">
                          Modelo Reutilizável
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {tpl.questions?.length || 0} questões
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-2 leading-snug">{tpl.title}</h3>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Aprovação: {tpl.passingScore}% • Cadastrado em {new Date(tpl.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleToggleTemplate(tpl.id, true)}
                        className="text-[11px] text-slate-500 hover:text-rose-400 font-semibold transition-colors"
                      >
                        Remover do Banco
                      </button>

                      <button
                        onClick={() => handleLoadTemplate(tpl)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-md"
                      >
                        <Sparkles size={13} />
                        <span>Reutilizar Formulário</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ========================================================================= */}
        {/* ABA 3: RELATÓRIO BI & DESEMPENHO (BUSINESS INTELLIGENCE)                  */}
        {/* ========================================================================= */}
        {activeTab === 'BI' && (
          <QuizBiDashboard
            organizerName={currentUser?.name || 'Técnico de Segurança'}
            companyName={currentUser?.company || 'DDS Online'}
            onOpenCollaboratorModal={handleOpenCollaboratorByName}
            onSelectQuizForRanking={(quizId) => {
              setSelectedRankingQuizId(quizId);
              setActiveTab('RANKING');
            }}
          />
        )}

        {/* ========================================================================= */}
        {/* MODAL DE DETALHES DO COLABORADOR: GABARITO, ACERTOS E ERROS              */}
        {/* ========================================================================= */}
        {selectedCollaborator && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in duration-200">
              
              {/* Header do Modal */}
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-950">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-md border border-teal-500/20">
                      Gabarito Individual do Colaborador
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      selectedCollaborator.avgScore >= 70 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}>
                      Aproveitamento: {selectedCollaborator.avgScore}%
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white">{selectedCollaborator.name}</h3>
                  <p className="text-xs text-slate-400">
                    Função: <strong className="text-slate-200">{selectedCollaborator.role}</strong> • Total de Avaliações: {selectedCollaborator.count}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedCollaborator(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Corpo com Avaliações e Gabarito */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
                {selectedCollaborator.attempts.map((att, attIdx) => (
                  <div key={att.attemptId || attIdx} className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avaliação</span>
                        <h4 className="text-sm font-bold text-white">{att.quizTitle}</h4>
                        <span className="text-[10px] text-slate-500">
                          Data: {new Date(att.submittedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                          att.passed 
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                            : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        }`}>
                          Nota: {att.score}% ({att.passed ? 'Aprovado' : 'Abaixo da Média'})
                        </span>
                      </div>
                    </div>

                    {/* Questões e Gabarito */}
                    <div className="space-y-3">
                      {att.questionsBreakdown.map((q, qIdx) => (
                        <div 
                          key={q.questionId || qIdx}
                          className={`p-3.5 rounded-xl border space-y-2 text-xs ${
                            q.isCorrect 
                              ? 'bg-slate-950/60 border-emerald-500/30' 
                              : 'bg-rose-950/20 border-rose-500/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-white text-xs leading-snug">
                              Questão {qIdx + 1}: {q.questionText}
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                              q.isCorrect 
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                                : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                            }`}>
                              {q.isCorrect ? '✓ Acertou (+1 pt)' : '✕ Errou (0 pt)'}
                            </span>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            {/* Resposta do Colaborador */}
                            <div className="flex items-start gap-1.5">
                              <span className="text-slate-400 font-semibold shrink-0">Resposta do Colaborador:</span>
                              <span className={`font-bold ${q.isCorrect ? 'text-emerald-300' : 'text-rose-300 line-through'}`}>
                                {q.selectedText}
                              </span>
                            </div>

                            {/* Gabarito Correto */}
                            <div className="flex items-start gap-1.5 p-2 bg-slate-900 rounded-lg border border-emerald-500/20">
                              <ShieldCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                                  Gabarito Oficial Correto:
                                </span>
                                <span className="font-bold text-white">{q.correctOptionText}</span>
                              </div>
                            </div>

                            {q.explanation && (
                              <p className="text-[11px] text-slate-400 italic pt-0.5">
                                Justificativa: {q.explanation}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
                <button
                  onClick={() => setSelectedCollaborator(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Fechar Visualização
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}

export const dynamic = 'force-dynamic';

export default function QuestionariosAdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-blue-600" />
      </div>
    }>
      <QuestionariosContent />
    </Suspense>
  );
}
