'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { 
  CheckCircle2, AlertTriangle, HelpCircle, ArrowRight, ArrowLeft,
  ShieldCheck, Award, AlertCircle, RefreshCw, UserCheck, User, Trophy, Loader2,
  Clock, Printer, Check, X, FileCheck, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import QuizRankingView from '@/components/QuizRankingView';

interface QuizOption {
  id: string;
  text: string;
  position: number;
}

interface QuizQuestion {
  id: string;
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  weight: number;
  position: number;
  options: QuizOption[];
}

interface QuizData {
  id: string;
  title: string;
  passingScore: number;
  showRanking?: boolean;
  meeting?: {
    topic: string;
    status: string;
  } | null;
  questions: QuizQuestion[];
}

function QuestionarioPublicoContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Identificação do participante (Apenas Nome e Função)
  const [attendanceId, setAttendanceId] = useState<string>('');
  const [attendanceProof, setAttendanceProof] = useState<string>('');
  const [collaboratorName, setCollaboratorName] = useState<string>('');
  const [collaboratorRole, setCollaboratorRole] = useState<string>('');

  // Respostas { [questionId]: string[] }
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Submissão e Resultado
  const [startTime] = useState<number>(() => Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any | null>(null);
  const [viewingPublicRanking, setViewingPublicRanking] = useState(false);
  const [isFinishedConfirmed, setIsFinishedConfirmed] = useState(false);

  function formatExecutionTime(seconds?: number | null): string {
    if (typeof seconds !== 'number' || seconds <= 0) return 'Menos de 1 min';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} seg`;
    if (secs === 0) return `${mins} min`;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }

  useEffect(() => {
    // 1. Tenta recuperar credencial de presença da URL ou sessionStorage (quando houver)
    const urlAttId = searchParams.get('attendanceId');
    const urlProof = searchParams.get('proof');
    const urlName = searchParams.get('name');

    const urlRole = searchParams.get('role');

    if (urlAttId && urlProof) {
      setAttendanceId(urlAttId);
      setAttendanceProof(urlProof);
      if (urlName) setCollaboratorName(decodeURIComponent(urlName));
      if (urlRole) setCollaboratorRole(decodeURIComponent(urlRole));
    } else {
      try {
        const stored = localStorage.getItem('dds_last_attendance');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.attendanceId && parsed.quizProof) {
            setAttendanceId(parsed.attendanceId);
            setAttendanceProof(parsed.quizProof);
            if (parsed.name) setCollaboratorName(parsed.name);
            if (parsed.role) setCollaboratorRole(parsed.role);
          }
        }
      } catch {}
    }

    // 2. Carrega questionário público
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/questionarios/publico?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (data.success && data.quiz) {
          setQuiz(data.quiz);
          setError(null);
        } else {
          setError(data.error || 'Questionário indisponível ou encerrado.');
        }
      } catch {
        setError('Falha de conexão ao carregar a avaliação.');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchQuiz();
  }, [token, searchParams]);

  const handleSelectOption = (question: QuizQuestion, optionId: string) => {
    setSelectedAnswers(prev => {
      const current = prev[question.id] || [];
      if (question.type === 'MULTIPLE_CHOICE') {
        const exists = current.includes(optionId);
        const next = exists ? current.filter(id => id !== optionId) : [...current, optionId];
        return { ...prev, [question.id]: next };
      } else {
        return { ...prev, [question.id]: [optionId] };
      }
    });
  };

  const handleSubmit = async () => {
    if (!quiz) return;

    // Se o questionário for autônomo ou não vinculado à presença, exige Nome e Função
    if (!attendanceId && !collaboratorName.trim()) {
      setError('Por favor, informe o Nome Completo do colaborador.');
      return;
    }
    if (!attendanceId && !collaboratorRole.trim()) {
      setError('Por favor, informe a Função do colaborador na operação.');
      return;
    }

    // Valida se todas as perguntas foram respondidas
    const unanswered = quiz.questions.find(q => !selectedAnswers[q.id] || selectedAnswers[q.id].length === 0);
    if (unanswered) {
      setError(`Por favor, responda a pergunta nº ${unanswered.position + 1} antes de enviar.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const timeSpentSeconds = Math.max(5, Math.round((Date.now() - startTime) / 1000));

    const payload = {
      token,
      attendanceId: attendanceId || undefined,
      attendanceProof: attendanceProof || undefined,
      participantName: collaboratorName.trim(),
      participantDoc: collaboratorRole.trim(),
      timeSpentSeconds,
      answers: quiz.questions.map(q => ({
        questionId: q.id,
        selectedOptionIds: selectedAnswers[q.id] || []
      }))
    };

    try {
      const res = await fetch('/api/questionarios/respostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success && data.result) {
        setSubmitResult(data.result);
      } else {
        setError(data.error || 'Não foi possível registrar as respostas.');
      }
    } catch {
      setError('Erro de rede ao enviar respostas. Verifique sua conexão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Carregando
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs text-slate-400 font-medium">Carregando questionário oficial...</p>
      </main>
    );
  }

  // Erro Geral
  if (error && !quiz) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-xl">
          <div className="inline-flex p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-lg font-bold text-white">Avaliação Indisponível</h1>
          <p className="text-xs text-slate-400">{error}</p>
          <Link href="/">
            <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all">
              Voltar ao Início
            </button>
          </Link>
        </div>
      </main>
    );
  }

  // Tela de Resultado pós-submissão
  if (submitResult) {
    const isPassed = submitResult.passed;

    // Visualização da Classificação Pública da Equipe
    if (viewingPublicRanking && quiz) {
      return (
        <main className="min-h-screen bg-slate-950 text-white py-6 px-3 sm:px-6 font-sans relative">
          <div className="max-w-3xl w-full mx-auto space-y-4">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-400">Classificação dos Colaboradores</span>
                <h2 className="text-sm font-bold text-white">{quiz.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingPublicRanking(false)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={13} /> Voltar ao Meu Gabarito
              </button>
            </div>

            <QuizRankingView
              quizId={quiz.id}
              quizTitle={quiz.title}
              passingScore={quiz.passingScore}
              ddsTopic={quiz.meeting?.topic}
              isPublicMode={true}
              shareToken={token}
            />

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsFinishedConfirmed(true)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Concluir e Finalizar
              </button>
            </div>
          </div>
        </main>
      );
    }

    // Tela de Confirmação de Finalização (Sem Redirecionar para Login)
    if (isFinishedConfirmed) {
      return (
        <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/10 blur-[130px] rounded-full pointer-events-none"></div>
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5 relative z-10 backdrop-blur-md">
            <div className="inline-flex p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner">
              <CheckCircle2 size={52} />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 inline-block">
                Tudo Pronto!
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">Avaliação Finalizada!</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Suas respostas e seu tempo de execução foram arquivados com sucesso no DDS Online.
              </p>
            </div>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-1 text-left">
              <div className="flex justify-between text-slate-300">
                <span>Colaborador:</span>
                <strong className="text-white">{submitResult.participantName || collaboratorName}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Tempo Gasto:</span>
                <strong className="text-emerald-400 font-bold">{formatExecutionTime(submitResult.timeSpentSeconds)}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Aproveitamento:</span>
                <strong className="text-white font-bold">{submitResult.score}%</strong>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Você já pode fechar esta janela no seu celular ou computador.
            </p>

            <button
              type="button"
              onClick={() => setIsFinishedConfirmed(false)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
            >
              <ArrowLeft size={14} /> Rever Meu Gabarito e Questões
            </button>
          </div>
        </main>
      );
    }

    const questionsBreakdown = submitResult.questions || [];

    return (
      <main className="min-h-screen bg-slate-950 text-white py-6 px-3 sm:px-6 font-sans relative">
        <div className="max-w-2xl w-full mx-auto space-y-5">
          {/* Header de Confirmação de Sucesso */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20 inline-block mb-1">
                  Avaliação Respondida com Sucesso
                </span>
                <h1 className="text-base sm:text-lg font-black text-white leading-tight">
                  {quiz?.title || 'Avaliação de Segurança'}
                </h1>
                {quiz?.meeting?.topic && (
                  <p className="text-xs text-slate-400 mt-0.5">DDS: <strong className="text-slate-300">{quiz.meeting.topic}</strong></p>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Participante Identificado</span>
                <strong className="text-white text-sm">{submitResult.participantName || collaboratorName}</strong>
                {(submitResult.participantRole || collaboratorRole) && (
                  <span className="text-slate-400 block text-[11px]">{submitResult.participantRole || collaboratorRole}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span className="text-[11px] text-slate-300 font-semibold">Registro Oficial Arquivado</span>
              </div>
            </div>

            {/* Grid com Métricas Principais: Aproveitamento, Acertos e Tempo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Aproveitamento */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aproveitamento</span>
                <div className="flex items-baseline justify-center gap-1">
                  <h3 className={`text-2xl font-black ${isPassed ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {submitResult.score}%
                  </h3>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block ${
                  isPassed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                }`}>
                  {isPassed ? 'Aprovado' : 'Abaixo da Média'}
                </span>
              </div>

              {/* Acertos */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Acertos</span>
                <div className="flex items-baseline justify-center gap-1">
                  <h3 className="text-2xl font-black text-white">
                    {submitResult.correctCount}
                  </h3>
                  <span className="text-xs text-slate-400">/ {submitResult.totalQuestions}</span>
                </div>
                <span className="text-[10px] text-slate-400 block">questões corretas</span>
              </div>

              {/* Tempo de Execução */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tempo de Execução</span>
                <div className="flex items-center justify-center gap-1.5 text-cyan-300">
                  <Clock size={16} />
                  <h3 className="text-xl font-black">
                    {formatExecutionTime(submitResult.timeSpentSeconds)}
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 block">duração da avaliação</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* GABARITO DETALHADO QUESTÃO POR QUESTÃO (ACERTOS E ERROS)                 */}
          {/* ========================================================================= */}
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck size={18} className="text-emerald-400" />
                <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  Gabarito da Avaliação (Seus Acertos e Erros)
                </h2>
              </div>
              <span className="text-[11px] text-slate-400 font-bold">
                {submitResult.correctCount} de {submitResult.totalQuestions} acertos
              </span>
            </div>

            <div className="space-y-4">
              {questionsBreakdown.map((q: any, qIdx: number) => {
                const isCorrect = Boolean(q.isCorrect);
                return (
                  <div
                    key={q.questionId || qIdx}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      isCorrect 
                        ? 'bg-emerald-950/15 border-emerald-500/30' 
                        : 'bg-rose-950/15 border-rose-500/30'
                    }`}
                  >
                    {/* Cabeçalho da Questão */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md inline-block border ${
                          isCorrect 
                            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' 
                            : 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                        }`}>
                          {isCorrect ? '✅ Você Acertou' : '❌ Você Errou'}
                        </span>
                        <h3 className="text-xs sm:text-sm font-bold text-white leading-snug pt-1">
                          {qIdx + 1}. {q.questionText}
                        </h3>
                      </div>
                    </div>

                    {/* Alternativas com Destaque de Escolha e Gabarito Correto */}
                    <div className="space-y-2 pt-1 text-xs">
                      {q.options?.map((opt: any) => {
                        const isSelected = Boolean(opt.isSelected);
                        const isOptCorrect = Boolean(opt.isCorrect);

                        // Estilo 1: Resposta que o colaborador marcou e estava CORRETA
                        if (isSelected && isOptCorrect) {
                          return (
                            <div
                              key={opt.id}
                              className="p-3 rounded-xl bg-emerald-500/20 border-2 border-emerald-500 text-emerald-200 font-semibold flex items-center justify-between gap-2 shadow-sm"
                            >
                              <div className="flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                                <span>{opt.text}</span>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-md shrink-0">
                                Sua Resposta (Correta) ✅
                              </span>
                            </div>
                          );
                        }

                        // Estilo 2: Resposta que o colaborador marcou e estava INCORRETA (ERRO)
                        if (isSelected && !isOptCorrect) {
                          return (
                            <div
                              key={opt.id}
                              className="p-3 rounded-xl bg-rose-500/20 border-2 border-rose-500 text-rose-200 font-semibold flex items-center justify-between gap-2 shadow-sm"
                            >
                              <div className="flex items-center gap-2">
                                <X size={16} className="text-rose-400 shrink-0" />
                                <span>{opt.text}</span>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/30 text-rose-300 px-2 py-0.5 rounded-md shrink-0">
                                Sua Resposta (Incorreta) ❌
                              </span>
                            </div>
                          );
                        }

                        // Estilo 3: Gabarito Oficial (quando o colaborador errou, mostra qual era o correto!)
                        if (!isSelected && isOptCorrect) {
                          return (
                            <div
                              key={opt.id}
                              className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 font-semibold flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <Check size={16} className="text-emerald-400 shrink-0" />
                                <span>{opt.text}</span>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md shrink-0">
                                Gabarito Correto 🎯
                              </span>
                            </div>
                          );
                        }

                        // Estilo 4: Opção neutra não marcada
                        return (
                          <div
                            key={opt.id}
                            className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-400 flex items-center gap-2"
                          >
                            <span className="w-2 h-2 rounded-full bg-slate-700 shrink-0"></span>
                            <span>{opt.text}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Explicação Pedagógica da Questão (se houver) */}
                    {q.explanation && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                        <Sparkles size={14} className="text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-amber-300 block text-[11px] uppercase">Nota Explicativa de Segurança:</strong>
                          <p className="text-slate-300 mt-0.5 leading-relaxed">{q.explanation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ========================================================================= */}
          {/* BOTÕES DE AÇÃO (SEM REDIRECIONAMENTO PARA TELA DE LOGIN)                  */}
          {/* ========================================================================= */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
            {quiz?.showRanking && (
              <button
                type="button"
                onClick={() => setViewingPublicRanking(true)}
                className="w-full py-3 bg-gradient-to-r from-amber-600/30 to-yellow-600/30 hover:from-amber-600/40 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trophy size={16} className="text-amber-400" />
                <span>Ver Classificação da Equipe (Ranking Completo)</span>
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
              >
                <Printer size={15} />
                <span>Imprimir / Salvar Gabarito</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFinishedConfirmed(true)}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Concluir Avaliação</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const currentQ = quiz?.questions[currentQuestionIndex];
  const totalQ = quiz?.questions.length || 0;

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-6 px-3 sm:px-6 font-sans relative">
      <div className="w-full max-w-xl mx-auto space-y-5">
        {/* Header do Questionário */}
        <header className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-lg space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck size={14} /> DDS ON • Avaliação
            </span>
            <span className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 font-mono text-[11px]">
              {quiz?.meeting?.topic ? `DDS: ${quiz.meeting.topic}` : 'Avaliação Autônoma'}
            </span>
          </div>

          <h1 className="text-lg sm:text-xl font-black text-white">{quiz?.title}</h1>

          {/* Campo de Identificação do Participante */}
          {attendanceId ? (
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs space-y-1">
              <div className="flex items-center gap-2 text-slate-300">
                <UserCheck size={16} className="text-emerald-400 shrink-0" />
                <span>Colaborador: <strong className="text-white">{collaboratorName}</strong></span>
              </div>
              {collaboratorRole ? (
                <p className="text-[11px] text-slate-400 pl-6">
                  Função: <strong className="text-emerald-400">{collaboratorRole}</strong>
                </p>
              ) : (
                <div className="pt-1.5 pl-6">
                  <input
                    type="text"
                    value={collaboratorRole}
                    onChange={e => setCollaboratorRole(e.target.value)}
                    placeholder="Sua Função na operação (ex: Motorista, Operador) *"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
                <User size={14} className="text-emerald-400" />
                <span>Identificação do Colaborador:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={collaboratorName}
                    onChange={e => setCollaboratorName(e.target.value)}
                    placeholder="Nome Completo do Colaborador *"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Função na Operação
                  </label>
                  <input
                    type="text"
                    value={collaboratorRole}
                    onChange={e => setCollaboratorRole(e.target.value)}
                    placeholder="Função (Ex: Motorista, Mecânico, etc.) *"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Barra de Progresso */}
          <div className="pt-2">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1.5 font-medium">
              <span>Questão {currentQuestionIndex + 1} de {totalQ}</span>
              <span>{Math.round(((currentQuestionIndex + 1) / totalQ) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / totalQ) * 100}%` }}
              />
            </div>
          </div>
        </header>

        {/* Mensagem de Erro de Validação */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Card da Questão */}
        {currentQ && (
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl space-y-5">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                {currentQ.type === 'MULTIPLE_CHOICE' ? 'Múltipla Escolha' : 'Escolha Única'}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                {currentQ.text}
              </h2>
            </div>

            {/* Alternativas */}
            <div className="space-y-2.5">
              {currentQ.options.map(opt => {
                const isSelected = (selectedAnswers[currentQ.id] || []).includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(currentQ, opt.id)}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600'
                    }`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </div>
                    <span className="leading-relaxed flex-1">{opt.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Navegação entre Questões */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-2">
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex(i => Math.max(0, i - 1))}
                disabled={currentQuestionIndex === 0}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 min-h-[40px]"
              >
                <ArrowLeft size={14} /> Anterior
              </button>

              {currentQuestionIndex < totalQ - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex(i => Math.min(totalQ - 1, i + 1))}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 min-h-[40px]"
                >
                  Próxima <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg flex items-center gap-1.5 min-h-[40px]"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      Finalizar e Enviar <CheckCircle2 size={15} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export const dynamic = 'force-dynamic';

export default function QuestionarioPublicoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-emerald-500" />
      </div>
    }>
      <QuestionarioPublicoContent />
    </Suspense>
  );
}

