'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, Trash2, CheckCircle2, AlertTriangle, 
  Copy, Check, Clock, Award, RefreshCw, Bookmark, BookmarkCheck,
  TrendingUp, Users, Target, BarChart2, Star, RotateCcw,
  Sparkles, Layers, BookOpen, ChevronRight, FileText, Eye, X, ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import DdsLogo from '@/components/DdsLogo';

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

export default function QuestionariosAdminPage() {
  const { user: currentUser } = useAuth();

  // Abas da tela: Avaliações Ativas, Banco de Formulários, e Inteligência BI
  const [activeTab, setActiveTab] = useState<'QUIZZES' | 'TEMPLATES' | 'BI'>('QUIZZES');

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
      fragilityReports,
      criticalFragilitiesCount: criticalFragilities.length
    };
  }, [quizzes]);

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

  return (
    <main className="min-h-screen bg-slate-950 text-white p-3 sm:p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <Link 
              href="/admin" 
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors border border-slate-700 flex items-center justify-center shrink-0"
              title="Voltar ao Painel Principal"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <DdsLogo size="sm" showSubtitle={false} clickable href="/admin" />
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Central de Avaliações & Inteligência
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Crie, reutilize formulários, aplique reavaliações e acompanhe a evolução do time via BI.
              </p>
            </div>
          </div>
        </header>

        {/* Abas de Navegação Superior */}
        <div className="grid grid-cols-1 sm:grid-cols-3 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl gap-1.5 shadow-lg">
          <button
            onClick={() => setActiveTab('QUIZZES')}
            className={`py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'QUIZZES'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Award size={16} />
            <span>Avaliações & Provas ({quizzes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('TEMPLATES')}
            className={`py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'TEMPLATES'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers size={16} />
            <span>Banco de Formulários ({templateQuizzes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('BI')}
            className={`py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'BI'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart2 size={16} />
            <span>Relatório BI & Desempenho</span>
          </button>
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
            
            {/* Barra de Filtro */}
            <section className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Filtrar Avaliações em Andamento
                </label>
                <span className="text-[11px] text-slate-400">
                  Total encontrado: <strong className="text-emerald-400">{quizzes.length}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={selectedMeetingId}
                  onChange={e => setSelectedMeetingId(e.target.value)}
                  className="w-full sm:col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white font-bold focus:border-emerald-500 outline-none min-h-[44px]"
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
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-700 min-h-[44px]"
                >
                  <RefreshCw size={14} className={isLoadingQuizzes ? 'animate-spin text-emerald-400' : ''} />
                  <span>Atualizar Lista</span>
                </button>
              </div>
            </section>

            {/* Listagem de Questionários com Ações de Reavaliação e Salvar Formulário */}
            <section className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-emerald-400" />
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">
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
            <section className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Plus size={18} className="text-emerald-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  Criar Nova Avaliação de Segurança
                </h2>
              </div>

              <form onSubmit={handleSaveQuiz} className="space-y-6">
                
                {/* Vínculo Opcional */}
                <div className="space-y-1.5 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Vínculo a um DDS (Opcional)</span>
                    <span className="text-[10px] text-emerald-400 font-normal lowercase">opcional</span>
                  </label>
                  <select
                    value={creationMeetingId}
                    onChange={e => setCreationMeetingId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white font-bold focus:border-emerald-500 outline-none"
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white font-bold focus:border-emerald-500 outline-none"
                    required
                  />
                </div>

                {/* Opção para Salvar como Formulário Reutilizável */}
                <div className="flex items-center gap-2.5 p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl">
                  <input
                    type="checkbox"
                    id="saveTemplateCheck"
                    checked={saveAsTemplate}
                    onChange={e => setSaveAsTemplate(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700"
                  />
                  <label htmlFor="saveTemplateCheck" className="text-xs text-slate-200 cursor-pointer select-none">
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-emerald-500 outline-none"
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-emerald-500 outline-none"
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

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
                    <div key={q.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className="text-xs font-black text-emerald-400">
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
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-400">Tipo de Resposta</label>
                          <select
                            value={q.type}
                            onChange={e => handleUpdateQuestion(q.id, { type: e.target.value as any })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
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
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
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
          <div className="space-y-6">
            
            {/* Cards de Métricas Gerais */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Aproveitamento Médio</span>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black text-emerald-400">{biMetrics.overallAvg}%</h3>
                  <span className="text-xs text-slate-400">média da equipe</span>
                </div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Avaliações Respondidas</span>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black text-white">{biMetrics.totalAttemptsCount}</h3>
                  <span className="text-xs text-slate-400">submissões</span>
                </div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Formulários no BI</span>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black text-teal-300">{biMetrics.totalQuizzesCount}</h3>
                  <span className="text-xs text-slate-400">cadastrados</span>
                </div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fragilidades Críticas</span>
                <div className="flex items-baseline gap-2">
                  <h3 className={`text-2xl font-black ${biMetrics.criticalFragilitiesCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {biMetrics.criticalFragilitiesCount}
                  </h3>
                  <span className="text-xs text-slate-400">temas com erro &gt; 50%</span>
                </div>
              </div>
            </div>

            {/* Destaques de Top Desempenho */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Formulário com Melhor Desempenho */}
              <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Star size={18} className="fill-emerald-400" />
                  <span className="text-xs font-black uppercase tracking-wider">Formulário com Melhor Desempenho</span>
                </div>

                {biMetrics.topForm ? (
                  <div className="space-y-1.5">
                    <h4 className="text-base font-bold text-white leading-snug">{biMetrics.topForm.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-slate-300">
                      <span>Média da Equipe: <strong className="text-emerald-400 font-black text-sm">{biMetrics.topForm.avgScore}%</strong></span>
                      <span>•</span>
                      <span>{biMetrics.topForm.count} participações</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Ainda não há dados suficientes para calcular o ranking.</p>
                )}
              </div>

              {/* Colaborador com Melhor Desempenho */}
              <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 border border-teal-500/30 rounded-2xl shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-teal-400">
                  <Award size={18} className="fill-teal-400" />
                  <span className="text-xs font-black uppercase tracking-wider">Colaborador com Melhor Desempenho</span>
                </div>

                {biMetrics.topParticipant ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold text-white leading-snug">{biMetrics.topParticipant.name}</h4>
                      <button
                        onClick={() => setSelectedCollaborator(biMetrics.topParticipant)}
                        className="px-2.5 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Ver erros, acertos e gabarito"
                      >
                        <Eye size={12} />
                        <span>Ver Gabarito</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">Função: <strong className="text-slate-200">{biMetrics.topParticipant.role}</strong></p>
                    <div className="flex items-center gap-3 text-xs text-slate-300">
                      <span>Média Individual: <strong className="text-teal-300 font-black text-sm">{biMetrics.topParticipant.avgScore}%</strong></span>
                      <span>•</span>
                      <span>{biMetrics.topParticipant.count} questionários respondidos</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Ainda não há respostas registradas para ranquear colaboradores.</p>
                )}
              </div>

            </div>

            {/* DIAGNÓSTICO DE FRAGILIDADES OPERACIONAIS & PLANO DE AÇÃO */}
            <section className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={18} className="text-amber-400" />
                    <h2 className="text-sm font-black text-white uppercase tracking-wider">
                      Diagnóstico de Fragilidades Operacionais & Planos de Ação
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Análise ponto a ponto dos erros cometidos pela equipe para geração imediata de planos de ação preventiva.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-slate-400 self-start sm:self-auto bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  Total de Questões Avaliadas: <strong className="text-white">{biMetrics.fragilityReports.length}</strong>
                </span>
              </div>

              {biMetrics.fragilityReports.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">Nenhuma resposta registrada ainda para calcular fragilidades.</p>
              ) : (
                <div className="space-y-4">
                  {biMetrics.fragilityReports.map((item, idx) => {
                    const isCritical = item.fragilityLevel === 'CRITICAL';
                    const isModerate = item.fragilityLevel === 'MODERATE';
                    return (
                      <div 
                        key={item.questionId || idx}
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          isCritical 
                            ? 'bg-rose-950/20 border-rose-500/30' 
                            : isModerate
                            ? 'bg-amber-950/20 border-amber-500/30'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                isCritical 
                                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' 
                                  : isModerate
                                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              }`}>
                                {isCritical ? '🚨 Fragilidade Crítica' : isModerate ? '⚠️ Ponto de Atenção' : '✅ Procedimento Seguro'}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {item.quizTitle}
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-white pt-1">{item.questionText}</h3>
                          </div>

                          {/* Medidor de Erro */}
                          <div className="text-right shrink-0">
                            <div className="flex items-baseline gap-1.5 justify-end">
                              <span className={`text-base font-black ${isCritical ? 'text-rose-400' : isModerate ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {item.errorRate}%
                              </span>
                              <span className="text-[11px] text-slate-400">taxa de erro</span>
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {item.errorCount} erros • {item.correctCount} acertos ({item.totalAnswered} respostas)
                            </span>
                          </div>
                        </div>

                        {/* Barra de Proporção */}
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex">
                          <div 
                            className="bg-emerald-500 h-full"
                            style={{ width: `${100 - item.errorRate}%` }}
                            title={`${100 - item.errorRate}% de Acertos`}
                          />
                          <div 
                            className={`h-full ${isCritical ? 'bg-rose-500' : 'bg-amber-500'}`}
                            style={{ width: `${item.errorRate}%` }}
                            title={`${item.errorRate}% de Erros`}
                          />
                        </div>

                        {/* Comparação Gabarito vs Desvio */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 bg-slate-900/80 rounded-xl border border-emerald-500/20 space-y-0.5">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 size={11} /> Gabarito Oficial (Procedimento Correto)
                            </span>
                            <p className="text-slate-200 font-semibold">{item.correctOptionText}</p>
                          </div>

                          {item.mostCommonWrongText ? (
                            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-rose-500/20 space-y-0.5">
                              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                                <AlertTriangle size={11} /> Desvio Mais Frequente Marcado Pela Equipe
                              </span>
                              <p className="text-slate-200 font-semibold">{item.mostCommonWrongText}</p>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-0.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Desvios Marcados
                              </span>
                              <p className="text-slate-400">Nenhum desvio expressivo registrado.</p>
                            </div>
                          )}
                        </div>

                        {/* Box de Plano de Ação Recomendado */}
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-1.5 text-teal-400 font-bold text-[11px] uppercase tracking-wider">
                              <Target size={13} />
                              <span>Plano de Ação Recomendado</span>
                            </div>
                            <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-line">
                              {item.actionPlan}
                            </p>
                          </div>

                          <button
                            onClick={() => handleCopyActionPlan(item.actionPlan, item.questionId)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 shrink-0 cursor-pointer"
                            title="Copiar texto do plano de ação para relatório ou WhatsApp"
                          >
                            {copiedPlanId === item.questionId ? (
                              <>
                                <Check size={13} className="text-emerald-400" />
                                <span className="text-emerald-400 font-bold">Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={13} />
                                <span>Copiar Ação</span>
                              </>
                            )}
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Tabelas de Ranking */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Top Formulários */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-lg">
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <BarChart2 size={15} className="text-emerald-400" /> Top Formulários por Média
                </h3>
                {biMetrics.rankingForms.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">Sem respostas registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {biMetrics.rankingForms.map((f, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-200 truncate">{f.title}</span>
                        </div>
                        <span className="font-black text-emerald-400 shrink-0">{f.avgScore}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Colaboradores (Clique para ver o gabarito) */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Users size={15} className="text-teal-400" /> Colaboradores ({biMetrics.rankingParticipants.length})
                  </h3>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Clique para ver gabarito
                  </span>
                </div>

                {biMetrics.rankingParticipants.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">Sem respostas registradas.</p>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {biMetrics.rankingParticipants.map((p, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedCollaborator(p)}
                        className="p-2.5 bg-slate-950 hover:bg-slate-900/90 border border-slate-800 hover:border-teal-500/40 rounded-xl flex items-center justify-between text-xs transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                            {idx + 1}
                          </span>
                          <div className="truncate">
                            <span className="font-bold text-white group-hover:text-teal-300 transition-colors block truncate">
                              {p.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {p.role} • {p.count} questionário(s)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-black ${p.avgScore >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {p.avgScore}%
                          </span>
                          <button
                            type="button"
                            className="p-1 bg-slate-900 group-hover:bg-teal-500/20 text-slate-400 group-hover:text-teal-300 rounded-md transition-colors"
                            title="Ver gabarito e respostas"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
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
    </main>
  );
}
