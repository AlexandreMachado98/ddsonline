'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, Trash2, CheckCircle2, AlertTriangle, 
  HelpCircle, Copy, Check, Radio, Clock, ShieldCheck, 
  FileText, Users, Award, ExternalLink, RefreshCw, Eye
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
  attendance: {
    id: string;
    name: string;
  };
}

interface ExistingQuiz {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  passingScore: number;
  criticalBelow: number;
  excellentFrom: number;
  shareToken: string;
  createdAt: string;
  publishedAt?: string;
  closedAt?: string;
  questions: any[];
  attempts: AttemptSummary[];
}

export default function QuestionariosAdminPage() {
  const { user: currentUser } = useAuth();

  // Reunião selecionada
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('');
  const [isLoadingMeetings, setIsLoadingMeetings] = useState<boolean>(true);

  // Questionários existentes da reunião selecionada
  const [quizzes, setQuizzes] = useState<ExistingQuiz[]>([]);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState<boolean>(false);

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

  // Mensagens e feedbacks
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // 1. Carrega reuniões disponíveis para o organizador
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
        if (list.length > 0 && !selectedMeetingId) {
          setSelectedMeetingId(list[0].id);
        }
      }
    } catch (e) {
      console.error('Erro ao buscar DDS:', e);
    } finally {
      setIsLoadingMeetings(false);
    }
  }, [currentUser?.id, selectedMeetingId]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // 2. Carrega questionários da reunião selecionada
  const fetchQuizzes = useCallback(async () => {
    if (!selectedMeetingId) return;
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
      // Se removeu a única correta, marca a primeira como correta
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

  // Salvar novo questionário no banco via POST /api/questionarios
  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!selectedMeetingId) {
      setStatusMessage({ type: 'error', text: 'Selecione um DDS para vincular o questionário.' });
      return;
    }

    if (!title.trim()) {
      setStatusMessage({ type: 'error', text: 'Defina um título para a avaliação.' });
      return;
    }

    // Validações locais antes do envio
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
          meetingId: selectedMeetingId,
          title: title.trim(),
          passingScore,
          criticalBelow,
          excellentFrom,
          questions
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Questionário criado com sucesso no banco de dados!' });
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

  // Publicar ou encerrar questionário via PATCH /api/questionarios
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
          text: nextStatus === 'PUBLISHED' ? 'Questionário publicado! Link liberado para os colaboradores.' : 'Questionário encerrado com sucesso.'
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

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);

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
                  Avaliações & Questionários
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Crie avaliações de percepção de risco e meça a assimilação dos colaboradores em tempo real.
              </p>
            </div>
          </div>
        </header>

        {/* Seletor de DDS */}
        <section className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            Vincular ao Diálogo Diário de Segurança (DDS)
          </label>
          {isLoadingMeetings ? (
            <div className="text-xs text-slate-400 flex items-center gap-2 py-2">
              <RefreshCw size={14} className="animate-spin text-emerald-400" /> Carregando reuniões cadastradas...
            </div>
          ) : meetings.length === 0 ? (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
              Nenhum DDS encontrado. Crie um DDS no painel principal antes de elaborar questionários.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={selectedMeetingId}
                onChange={e => setSelectedMeetingId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white font-bold focus:border-emerald-500 outline-none min-h-[44px]"
              >
                {meetings.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.status === 'LIVE' ? '🟢 AO VIVO: ' : '📁 '} {m.topic} — {m.farm || 'Sem local'}
                  </option>
                ))}
              </select>
              {selectedMeeting && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs flex items-center justify-between text-slate-300">
                  <span>Status: <strong className={selectedMeeting.status === 'LIVE' ? 'text-emerald-400' : 'text-slate-400'}>{selectedMeeting.status === 'LIVE' ? 'Em Andamento' : 'Arquivado'}</strong></span>
                  <span className="text-[11px] text-slate-400">{new Date(selectedMeeting.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}
        </section>

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

        {/* Questionários Existentes nesta Reunião */}
        <section className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Award size={18} className="text-emerald-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                Questionários Vinculados a este DDS ({quizzes.length})
              </h2>
            </div>
            <button
              onClick={fetchQuizzes}
              disabled={isLoadingQuizzes}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
              title="Atualizar lista de avaliações"
            >
              <RefreshCw size={13} className={isLoadingQuizzes ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>

          {isLoadingQuizzes ? (
            <p className="text-xs text-slate-400 py-3">Buscando avaliações associadas...</p>
          ) : quizzes.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">Nenhum questionário cadastrado para este DDS ainda. Use o formulário abaixo para criar o primeiro.</p>
          ) : (
            <div className="space-y-3">
              {quizzes.map(q => (
                <div key={q.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                          q.status === 'PUBLISHED' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                          q.status === 'CLOSED' ? 'bg-slate-800 border-slate-700 text-slate-400' :
                          'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        }`}>
                          {q.status === 'PUBLISHED' ? 'Ativo / Publicado' : q.status === 'CLOSED' ? 'Encerrado' : 'Rascunho'}
                        </span>
                        <h3 className="text-sm font-bold text-white">{q.title}</h3>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Nota Mínima: {q.passingScore}% • Total de Questões: {q.questions?.length || 0} • Respostas Recebidas: {q.attempts?.length || 0}
                      </p>
                    </div>

                    {/* Ações do Questionário */}
                    <div className="flex items-center gap-2 flex-wrap">
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
                    </div>
                  </div>

                  {/* Resumo de Respostas dos Participantes */}
                  {q.attempts && q.attempts.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <p className="text-[11px] font-bold text-slate-300 mb-2">Desempenho dos Participantes:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {q.attempts.map(att => (
                          <div key={att.id} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-[11px] flex items-center justify-between">
                            <span className="font-semibold text-slate-200 truncate pr-2">{att.attendance.name}</span>
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

        {/* Formulário de Criação de Questionário */}
        <section className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Plus size={18} className="text-emerald-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              Criar Nova Avaliação de Segurança
            </h2>
          </div>

          <form onSubmit={handleSaveQuiz} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Título do Questionário
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Avaliação de Percepção de Risco - Trabalho em Altura & EPIs"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white font-bold focus:border-emerald-500 outline-none"
                required
              />
            </div>

            {/* Parâmetros de Desempenho */}
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

            {/* Lista de Perguntas */}
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
                      placeholder="Ex: O que deve ser feito ao constatar que um cinto de segurança possui desgaste na fita?"
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
              disabled={isSaving || !selectedMeetingId}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 disabled:opacity-50 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 min-h-[44px]"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={15} className="animate-spin" /> Salvando Avaliação no Servidor...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Gravar Questionário no DDS
                </>
              )}
            </button>
          </form>
        </section>

      </div>
    </main>
  );
}
