'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, Trash2, CheckCircle2, AlertTriangle, 
  Copy, Check, Clock, Award, RefreshCw, Bookmark, BookmarkCheck,
  TrendingUp, Users, Target, BarChart2, Star, RotateCcw,
  Sparkles, Layers, BookOpen, ChevronRight, FileText
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

interface AttemptSummary {
  id: string;
  score: number;
  passed: boolean;
  level: string;
  submittedAt: string;
  participantName?: string | null;
  attendance?: {
    id: string;
    name: string;
  } | null;
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
  const fetchQuizzes = useCallback(async () => {
    try {
      setIsLoadingQuizzes(true);
      const res = await fetch(`/api/questionarios?meetingId=${encodeURIComponent(selectedMeetingId)}`);
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

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  // Formulários salvos (Templates reutilizáveis)
  const templateQuizzes = quizzes.filter(q => q.isTemplate);

  // Métricas de Business Intelligence (BI)
  const biMetrics = React.useMemo(() => {
    const totalQuizzesCount = quizzes.length;
    let totalAttemptsCount = 0;
    let totalScoreSum = 0;

    // Mapa de desempenho por Formulário/Questionário
    const formStats: Record<string, { title: string; count: number; totalScore: number; avgScore: number }> = {};

    // Mapa de desempenho por Colaborador
    const participantStats: Record<string, { name: string; count: number; totalScore: number; avgScore: number; passedCount: number }> = {};

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

        // Stats do Colaborador
        const pName = (att.participantName || att.attendance?.name || 'Anônimo').trim();
        if (!participantStats[pName]) {
          participantStats[pName] = { name: pName, count: 0, totalScore: 0, avgScore: 0, passedCount: 0 };
        }
        participantStats[pName].count++;
        participantStats[pName].totalScore += att.score;
        if (att.passed) participantStats[pName].passedCount++;
      });
    });

    // Calcula médias
    Object.values(formStats).forEach(f => {
      f.avgScore = f.count > 0 ? Math.round((f.totalScore / f.count) * 10) / 10 : 0;
    });
    Object.values(participantStats).forEach(p => {
      p.avgScore = p.count > 0 ? Math.round((p.totalScore / p.count) * 10) / 10 : 0;
    });

    const overallAvg = totalAttemptsCount > 0 ? Math.round((totalScoreSum / totalAttemptsCount) * 10) / 10 : 0;

    // Melhores Formulários (com ao menos 1 resposta)
    const sortedForms = Object.values(formStats).filter(f => f.count > 0).sort((a, b) => b.avgScore - a.avgScore);
    const topForm = sortedForms[0] || null;

    // Melhores Colaboradores (com ao menos 1 resposta)
    const sortedParticipants = Object.values(participantStats).filter(p => p.count > 0).sort((a, b) => b.avgScore - a.avgScore);
    const topParticipant = sortedParticipants[0] || null;

    return {
      totalQuizzesCount,
      totalAttemptsCount,
      overallAvg,
      topForm,
      topParticipant,
      rankingForms: sortedForms.slice(0, 5),
      rankingParticipants: sortedParticipants.slice(0, 5)
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
                  onClick={fetchQuizzes}
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
                          {/* Salvar na Biblioteca de Formulários */}
                          <button
                            onClick={() => handleToggleTemplate(q.id, Boolean(q.isTemplate))}
                            className={`p-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
                              q.isTemplate 
                                ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 hover:bg-cyan-900' 
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                            title={q.isTemplate ? 'Remover do Banco de Formulários' : 'Salvar no Banco de Formulários'}
                          >
                            <Bookmark size={13} className={q.isTemplate ? 'fill-cyan-400 text-cyan-400' : ''} />
                            <span className="hidden sm:inline">{q.isTemplate ? 'Salvo no Banco' : 'Guardar Formulário'}</span>
                          </button>

                          {q.status === 'DRAFT' && (
                            <button
                              onClick={() => handleUpdateStatus(q.id, 'PUBLISHED')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-lg transition-all"
                            >
                              Publicar Avaliação
                            </button>
                          )}

                          {q.status === 'PUBLISHED' && (
                            <>
                              <button
                                onClick={() => handleCopyLink(q.shareToken)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg border border-slate-700 flex items-center gap-1.5 transition-all"
                              >
                                {copiedToken === q.shareToken ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                <span>{copiedToken === q.shareToken ? 'Link Copiado!' : 'Copiar Link'}</span>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(q.id, 'CLOSED')}
                                className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition-all"
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Aproveitamento Médio Geral</span>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black text-emerald-400">{biMetrics.overallAvg}%</h3>
                  <span className="text-xs text-slate-400">média da equipe</span>
                </div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Avaliações Respondidas</span>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black text-white">{biMetrics.totalAttemptsCount}</h3>
                  <span className="text-xs text-slate-400">submissões registradas</span>
                </div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Questionários Ativos / Histórico</span>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black text-teal-300">{biMetrics.totalQuizzesCount}</h3>
                  <span className="text-xs text-slate-400">formulários cadastrados</span>
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
                    <h4 className="text-base font-bold text-white leading-snug">{biMetrics.topParticipant.name}</h4>
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

              {/* Top Colaboradores */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-lg">
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Users size={15} className="text-teal-400" /> Top Colaboradores por Aproveitamento
                </h3>
                {biMetrics.rankingParticipants.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">Sem respostas registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {biMetrics.rankingParticipants.map((p, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-200 truncate">{p.name}</span>
                        </div>
                        <span className="font-black text-teal-300 shrink-0">{p.avgScore}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </div>
    </main>
  );
}
